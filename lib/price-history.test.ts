import { describe, expect, it } from "vitest";
import { filterTrustedHistory, getSourceTrust, parseProviderDate } from "@/lib/price-history";

/*
Tests for the shared rules deciding which saved prices count as real market
data in history, "Change" and the portfolio chart.
*/

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-11-01T00:00:00Z").getTime();

function row(source: string, marketPrice: number, createdDay: number, lastUpdatedDay = createdDay) {
  return {
    source,
    marketPrice,
    createdAt: new Date(t0 + createdDay * DAY),
    lastUpdated: new Date(t0 + lastUpdatedDay * DAY),
  };
}

describe("getSourceTrust", () => {
  it("ranks TCGplayer above eBay and unknown sources lowest", () => {
    expect(getSourceTrust("tcgplayer")).toBeGreaterThan(getSourceTrust("ebay"));
    expect(getSourceTrust("ebay")).toBeGreaterThan(getSourceTrust("something-else"));
  });
});

describe("filterTrustedHistory", () => {
  it("drops manual, simulated and rarity-guess rows", () => {
    const rows = [
      row("tcgplayer", 100, 0),
      row("manual", 1, 1),
      row("simulated", 300, 2),
      row("estimated-rarity", 50, 3),
    ];
    expect(filterTrustedHistory(rows).map((r) => r.source)).toEqual(["tcgplayer"]);
  });

  it("drops an eBay price saved while a TCGplayer price was still recent (the Charizard case)", () => {
    const rows = [row("tcgplayer", 954.65, 0), row("ebay", 331.25, 1), row("ebay", 350, 2)];
    expect(filterTrustedHistory(rows).map((r) => r.marketPrice)).toEqual([954.65]);
  });

  it("keeps an eBay price saved before any TCGplayer price existed", () => {
    const rows = [row("ebay", 430, 0), row("tcgplayer", 586.76, 1)];
    expect(filterTrustedHistory(rows).map((r) => r.marketPrice)).toEqual([430, 586.76]);
  });

  it("keeps an eBay price once the TCGplayer price is more than 7 days old", () => {
    const rows = [row("tcgplayer", 100, 0), row("ebay", 90, 8)];
    expect(filterTrustedHistory(rows)).toHaveLength(2);
  });

  it("counts a re-confirmed TCGplayer price (bumped lastUpdated) as still recent", () => {
    // created day 0, re-confirmed day 6, eBay on day 10 is within 7 days of day 6
    const rows = [row("tcgplayer", 100, 0, 6), row("ebay", 90, 10)];
    expect(filterTrustedHistory(rows).map((r) => r.source)).toEqual(["tcgplayer"]);
  });

  it("never drops the higher-trust rows and keeps the input order", () => {
    const rows = [row("tcgplayer", 3, 2), row("tcgplayer", 1, 0), row("tcgplayer", 2, 1)];
    expect(filterTrustedHistory(rows).map((r) => r.marketPrice)).toEqual([3, 1, 2]);
  });

  it("handles an empty history", () => {
    expect(filterTrustedHistory([])).toEqual([]);
  });
});

describe("parseProviderDate", () => {
  it("parses pokemontcg.io's slash dates as midnight UTC", () => {
    expect(parseProviderDate("2026/10/15")?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("parses ISO dates", () => {
    expect(parseProviderDate("2026-10-15T12:30:00Z")?.toISOString()).toBe("2026-10-15T12:30:00.000Z");
  });

  it("returns null for missing or garbage values instead of an invalid date", () => {
    expect(parseProviderDate(null)).toBeNull();
    expect(parseProviderDate("")).toBeNull();
    expect(parseProviderDate("not a date")).toBeNull();
  });
});
