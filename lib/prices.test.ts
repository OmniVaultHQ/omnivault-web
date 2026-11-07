import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceResult } from "@/lib/price-providers";

/*
Tests for savePriceForItem: what gets written when a provider returns a price.
Prisma is replaced by a tiny in-memory fake and the provider result is set per
test, so these run without a database or network.
*/

type PriceRow = {
  id: string;
  itemId: string;
  marketPrice: number;
  source: string;
  currency: string;
  confidence: string | null;
  sampleSize: number | null;
  providerUpdatedAt: Date | null;
  createdAt: Date;
  lastUpdated: Date;
};
type OwnedRow = {
  id: string;
  itemId: string;
  manualPriceLocked: boolean;
  marketPrice: number | null;
  priceSource: string | null;
  lastPriceUpdated: Date | null;
};

const db = vi.hoisted(() => ({
  prices: [] as PriceRow[],
  owned: [] as OwnedRow[],
  itemMarketPrice: null as number | null,
  nextId: 1,
}));

const provider = vi.hoisted(() => ({ result: null as PriceResult | null }));

const NOW = new Date("2026-11-07T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

vi.mock("@/lib/price-providers", () => ({
  getBestProviderPrice: vi.fn(async () => provider.result),
}));

vi.mock("@/lib/prisma", () => {
  type Where = {
    itemId?: string;
    source?: { in?: string[]; notIn?: string[] };
    lastUpdated?: { gte?: Date };
  };
  const matches = (r: PriceRow, w: Where) =>
    (!w.itemId || r.itemId === w.itemId) &&
    (!w.source?.in || w.source.in.includes(r.source)) &&
    (!w.source?.notIn || !w.source.notIn.includes(r.source)) &&
    (!w.lastUpdated?.gte || r.lastUpdated >= w.lastUpdated.gte);

  return {
    prisma: {
      item: {
        findUnique: async () => ({
          id: "item-1", name: "Charizard", category: "card", game: "Pokémon", set: "Base",
          setCode: "base1", itemNumber: "4", rarity: "Rare Holo", externalId: "base1-4", isCustom: false,
        }),
        update: async ({ data }: { data: { marketPrice: number } }) => {
          db.itemMarketPrice = data.marketPrice;
        },
      },
      itemPrice: {
        findFirst: async ({ where, orderBy }: { where: Where; orderBy: Record<string, "desc"> }) => {
          const key = Object.keys(orderBy)[0] as "createdAt" | "lastUpdated";
          return (
            db.prices
              .filter((r) => matches(r, where))
              .sort((a, b) => b[key].getTime() - a[key].getTime())[0] ?? null
          );
        },
        create: async ({ data }: { data: Partial<PriceRow> }) => {
          const row = {
            id: `p${db.nextId++}`, currency: "USD", confidence: null, sampleSize: null,
            providerUpdatedAt: null, createdAt: NOW, lastUpdated: NOW, ...data,
          } as PriceRow;
          db.prices.push(row);
          return row;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<PriceRow> }) => {
          const row = db.prices.find((r) => r.id === where.id)!;
          Object.assign(row, data, { lastUpdated: NOW }); // @updatedAt
          return row;
        },
      },
      collectionItem: {
        updateMany: async ({ where, data }: { where: { itemId: string; manualPriceLocked: boolean }; data: Partial<OwnedRow> }) => {
          const rows = db.owned.filter((r) => r.itemId === where.itemId && r.manualPriceLocked === where.manualPriceLocked);
          rows.forEach((r) => Object.assign(r, data));
          return { count: rows.length };
        },
      },
    },
  };
});

const { savePriceForItem } = await import("@/lib/prices");

function addPrice(source: string, marketPrice: number, createdDaysAgo: number, lastUpdatedDaysAgo = createdDaysAgo) {
  db.prices.push({
    id: `p${db.nextId++}`, itemId: "item-1", marketPrice, source, currency: "USD", confidence: null,
    sampleSize: null, providerUpdatedAt: null, createdAt: daysAgo(createdDaysAgo), lastUpdated: daysAgo(lastUpdatedDaysAgo),
  });
}

const tcg = (marketPrice: number): PriceResult => ({
  marketPrice, source: "tcgplayer", confidence: "high", providerUpdatedAt: "2026/10/15",
});
const ebay = (marketPrice: number, sampleSize = 10): PriceResult => ({
  marketPrice, source: "ebay", confidence: sampleSize >= 8 ? "medium" : "low", sampleSize,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  db.prices = [];
  db.owned = [
    { id: "o1", itemId: "item-1", manualPriceLocked: false, marketPrice: null, priceSource: null, lastPriceUpdated: null },
    { id: "o2", itemId: "item-1", manualPriceLocked: true, marketPrice: 1234, priceSource: "manual", lastPriceUpdated: daysAgo(3) },
  ];
  db.itemMarketPrice = null;
  provider.result = null;
});

describe("savePriceForItem", () => {
  it("saves nothing when no provider has a trustworthy price", async () => {
    expect(await savePriceForItem("item-1")).toEqual({ status: "no-price" });
    expect(db.prices).toHaveLength(0);
    expect(db.owned[0].marketPrice).toBeNull();
  });

  it("saves a first price with its quality details and syncs unlocked owned rows only", async () => {
    provider.result = tcg(954.65);
    const outcome = await savePriceForItem("item-1");

    expect(outcome).toMatchObject({ status: "saved", price: 954.65, source: "tcgplayer", syncedRows: 1 });
    expect(db.prices).toHaveLength(1);
    expect(db.prices[0]).toMatchObject({
      marketPrice: 954.65, source: "tcgplayer", currency: "USD", confidence: "high",
      providerUpdatedAt: new Date("2026-10-15T00:00:00Z"),
    });
    expect(db.itemMarketPrice).toBe(954.65);
    expect(db.owned[0]).toMatchObject({ marketPrice: 954.65, priceSource: "tcgplayer" });
    expect(db.owned[1]).toMatchObject({ marketPrice: 1234, priceSource: "manual" }); // locked: untouched
  });

  it("re-confirms an unchanged price by bumping lastUpdated instead of adding a duplicate row", async () => {
    addPrice("tcgplayer", 954.65, 2);
    provider.result = tcg(954.65);

    expect((await savePriceForItem("item-1")).status).toBe("unchanged");
    expect(db.prices).toHaveLength(1);
    expect(db.prices[0].lastUpdated).toEqual(NOW);
  });

  it("keeps a recent TCGplayer price instead of a weaker eBay price (provider outage)", async () => {
    addPrice("tcgplayer", 954.65, 1);
    provider.result = ebay(331.25);

    const outcome = await savePriceForItem("item-1");
    expect(outcome).toMatchObject({ status: "kept", price: 954.65, source: "tcgplayer" });
    expect(db.prices).toHaveLength(1); // eBay price not saved
    expect(db.owned[0]).toMatchObject({ marketPrice: 954.65, priceSource: "tcgplayer", lastPriceUpdated: daysAgo(1) });
  });

  it("uses eBay again once the TCGplayer price is more than 7 days old", async () => {
    addPrice("tcgplayer", 100, 8);
    provider.result = ebay(95);

    expect((await savePriceForItem("item-1")).status).toBe("saved");
    expect(db.prices.at(-1)).toMatchObject({ source: "ebay", marketPrice: 95, confidence: "medium", sampleSize: 10 });
  });

  it("rejects a non-high-confidence price that jumps more than 5x from the last real price", async () => {
    addPrice("ebay", 100, 1);
    provider.result = ebay(650, 3);

    const outcome = await savePriceForItem("item-1");
    expect(outcome).toMatchObject({ status: "rejected", previous: 100 });
    expect(db.prices).toHaveLength(1);
    expect(db.owned[0].marketPrice).toBeNull();
  });

  it("lets a high-confidence TCGplayer price through even after a big jump", async () => {
    addPrice("ebay", 100, 1);
    provider.result = tcg(900);
    expect((await savePriceForItem("item-1")).status).toBe("saved");
  });

  it("ignores manual and rarity-guess rows as the jump baseline (old fake $50 starter price)", async () => {
    addPrice("estimated-rarity", 50, 5);
    addPrice("manual", 1, 4);
    provider.result = ebay(430);

    expect((await savePriceForItem("item-1")).status).toBe("saved");
    expect(db.prices.at(-1)).toMatchObject({ source: "ebay", marketPrice: 430 });
  });
});
