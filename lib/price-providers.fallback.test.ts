import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBestProviderPrice, type PricingItem } from "@/lib/price-providers";

/*
Routing tests with the network mocked: which provider is tried, retries on
pokemontcg.io failures, and fallback to eBay. No real HTTP calls are made.
*/

const charizard: PricingItem = {
  id: "item-1",
  name: "Charizard",
  category: "card",
  game: "Pokémon",
  set: "Base",
  setCode: "base1",
  itemNumber: "4",
  rarity: "Rare Holo",
  externalId: "base1-4",
  isCustom: false,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const tcgOk = json({
  data: {
    id: "base1-4",
    name: "Charizard",
    rarity: "Rare Holo",
    tcgplayer: { updatedAt: "2026/10/15", prices: { holofoil: { market: 954.65 } } },
  },
});

function ebayListings(prices: number[], title = "Charizard 4/102 Base Set Holo") {
  return json({ itemSummaries: prices.map((value) => ({ title, price: { value: String(value), currency: "USD" } })) });
}

const ebayToken = () => json({ access_token: "test-token", expires_in: 7200 });

type Route = (url: string) => Response | Promise<Response>;

function mockFetch(route: Route) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => route(String(input)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof mockFetch>, host: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(host)).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  delete process.env.PRICING_ALLOW_SIMULATED;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Run a pricing call while letting retry backoff timers fire instantly
async function run(item: PricingItem) {
  const promise = getBestProviderPrice(item);
  await vi.runAllTimersAsync();
  return promise;
}

describe("getBestProviderPrice", () => {
  it("uses TCGplayer first and does not call eBay when it succeeds", async () => {
    const fetchMock = mockFetch((url) => (url.includes("pokemontcg.io") ? tcgOk.clone() : ebayToken()));
    const result = await run(charizard);
    expect(result).toMatchObject({ marketPrice: 954.65, source: "tcgplayer", confidence: "high", providerUpdatedAt: "2026/10/15" });
    expect(calls(fetchMock, "ebay.com")).toBe(0);
  });

  it("retries pokemontcg.io after a 5xx and succeeds on a later attempt", async () => {
    let attempt = 0;
    const fetchMock = mockFetch((url) => {
      if (url.includes("pokemontcg.io")) return ++attempt < 3 ? json({}, 503) : tcgOk.clone();
      return ebayToken();
    });
    const result = await run(charizard);
    expect(result?.source).toBe("tcgplayer");
    expect(calls(fetchMock, "pokemontcg.io")).toBe(3);
  });

  it("retries a hung (timed-out) pokemontcg.io request", async () => {
    let attempt = 0;
    mockFetch((url) => {
      if (url.includes("pokemontcg.io")) {
        attempt++;
        if (attempt === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        return tcgOk.clone();
      }
      return ebayToken();
    });
    const result = await run(charizard);
    expect(result?.source).toBe("tcgplayer");
    expect(attempt).toBe(2);
  });

  it("falls back to eBay after 3 failed pokemontcg.io attempts", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes("pokemontcg.io")) return json({}, 500);
      if (url.includes("oauth2/token")) return ebayToken();
      return ebayListings([300, 320, 340, 350, 360, 380, 400, 420]);
    });
    const result = await run(charizard);
    expect(calls(fetchMock, "pokemontcg.io")).toBe(3);
    expect(result).toMatchObject({ source: "ebay", marketPrice: 355, confidence: "medium", sampleSize: 8 });
  });

  it("marks eBay prices from fewer than 8 listings as low confidence", async () => {
    mockFetch((url) => {
      if (url.includes("pokemontcg.io")) return json({}, 500);
      if (url.includes("oauth2/token")) return ebayToken();
      return ebayListings([300, 320, 340]);
    });
    const result = await run(charizard);
    expect(result).toMatchObject({ source: "ebay", confidence: "low", sampleSize: 3 });
  });

  it("returns null (no price) rather than guessing when eBay has too few matching listings", async () => {
    mockFetch((url) => {
      if (url.includes("pokemontcg.io")) return json({}, 500);
      if (url.includes("oauth2/token")) return ebayToken();
      // only one listing actually matches (the others are graded / lots)
      return json({
        itemSummaries: [
          { title: "Charizard 4/102 Base Set Holo", price: { value: "300" } },
          { title: "Charizard 4/102 Base Set PSA 10", price: { value: "20000" } },
          { title: "Base Set Lot Charizard 4/102", price: { value: "900" } },
        ],
      });
    });
    expect(await run(charizard)).toBeNull();
  });

  it("skips TCGplayer for items without a pokemontcg.io id and never prices custom items", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes("oauth2/token")) return ebayToken();
      return ebayListings([10, 11, 12, 13, 14, 15, 16, 17], "Gundam Aerial GD01-001 Newtype Rising");
    });

    const gundam = { ...charizard, name: "Gundam Aerial", game: "Gundam Card Game", set: "Newtype Rising", itemNumber: "GD01-001", externalId: null };
    expect((await run(gundam))?.source).toBe("ebay");
    expect(calls(fetchMock, "pokemontcg.io")).toBe(0);

    fetchMock.mockClear();
    expect(await run({ ...gundam, isCustom: true })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
