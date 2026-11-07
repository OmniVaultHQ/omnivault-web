import { describe, expect, it } from "vitest";
import {
  getItemKind,
  getMedianPrice,
  numberAppearsInTitle,
  removeOutliers,
  selectTcgPlayerPrice,
  titleMatchesItem,
  type PricingItem,
} from "@/lib/price-providers";

/*
Unit tests for the pure matching/statistics helpers that decide whether an
eBay listing is the same item and which TCGplayer printing is used.
*/

function makeItem(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item",
    name: "Charizard",
    category: "card",
    game: "Pokémon",
    set: "Base",
    setCode: "base1",
    itemNumber: "4",
    rarity: "Rare Holo",
    externalId: "base1-4",
    isCustom: false,
    ...overrides,
  };
}

const charizard = makeItem({});

describe("titleMatchesItem — cards", () => {
  it.each([
    "Charizard 4/102 Base Set Holo Rare Pokemon Card",
    "Charizard #4 Base Set Unlimited",
    "CHARIZARD 004/102 base set holo",
    "Charizard - 4/102 - Base Set (Holo)",
  ])("matches a genuine single listing: %s", (title) => {
    expect(titleMatchesItem(title, charizard)).toBe(true);
  });

  it.each([
    ["missing card number", "Charizard Base Set Holo"],
    ["different card number", "Charizard 14/102 Base Set"],
    ["graded slab", "Charizard 4/102 Base Set PSA 9"],
    ["graded slab (BGS)", "Charizard 4/102 Base Set BGS 8.5"],
    ["lot", "Pokemon Base Set Lot Charizard 4/102 Blastoise"],
    ["proxy", "Charizard 4/102 Base Set Proxy Card"],
    ["foreign language", "Charizard 4/102 Base Set Japanese"],
    ["damaged copy", "Charizard 4/102 Base Set Damaged"],
    ["pick-your-card listing", "Base Set Charizard 4/102 You Pick"],
    ["name word missing", "Blaine's 4/102 Base Set"],
  ])("rejects %s: %s", (_reason, title) => {
    expect(titleMatchesItem(title, charizard)).toBe(false);
  });

  it("requires every word of a multi-word name", () => {
    const blaines = makeItem({ name: "Blaine's Charizard", set: "Gym Challenge", itemNumber: "2" });
    expect(titleMatchesItem("Blaine's Charizard 2/132 Gym Challenge Holo", blaines)).toBe(true);
    expect(titleMatchesItem("Charizard 2/132 Gym Challenge Holo", blaines)).toBe(false);
  });

  it("allows a foreign-language listing when the set itself is that language", () => {
    const japanese = makeItem({ set: "Japanese Base Set" });
    expect(titleMatchesItem("Charizard 4 Japanese Base Set Holo", japanese)).toBe(true);
  });

  it("matches alphanumeric card numbers (Gundam style)", () => {
    const gundam = makeItem({
      name: "Gundam Aerial",
      game: "Gundam Card Game",
      set: "Newtype Rising",
      itemNumber: "GD01-001",
      externalId: null,
    });
    expect(titleMatchesItem("Gundam Aerial GD01-001 LR Newtype Rising", gundam)).toBe(true);
    expect(titleMatchesItem("Gundam Aerial GD01-002 Newtype Rising", gundam)).toBe(false);
    expect(titleMatchesItem("Gundam Aerial GD01-001 sleeve only", gundam)).toBe(false);
  });
});

describe("titleMatchesItem — other categories", () => {
  const earthbound = makeItem({
    name: "EarthBound",
    category: "video game",
    game: "Super Nintendo",
    set: "SNES",
    itemNumber: null,
    rarity: null,
    externalId: null,
  });
  const optimus = makeItem({
    name: "Optimus Prime",
    category: "figure",
    game: "Transformers",
    set: "Masterpiece",
    itemNumber: "MP-44",
    rarity: null,
    externalId: null,
  });

  it.each([
    "EarthBound SNES Super Nintendo Cartridge Authentic",
    "EarthBound SNES CIB Complete In Box",
  ])("matches a genuine video game listing: %s", (title) => {
    expect(titleMatchesItem(title, earthbound)).toBe(true);
  });

  it.each([
    "EarthBound SNES Box Only No Game",
    "EarthBound SNES Reproduction Cart",
    "EarthBound SNES Manual Only",
    "EarthBound SNES Graded WATA 9.4",
  ])("rejects a partial/fake/graded video game listing: %s", (title) => {
    expect(titleMatchesItem(title, earthbound)).toBe(false);
  });

  it("matches a genuine figure and rejects knock-offs and broken ones", () => {
    expect(titleMatchesItem("Transformers Masterpiece MP-44 Optimus Prime", optimus)).toBe(true);
    expect(titleMatchesItem("Transformers MP-44 Optimus Prime KO Version", optimus)).toBe(false);
    expect(titleMatchesItem("Optimus Prime MP-44 For Parts Broken", optimus)).toBe(false);
  });

  it("only treats 'ko' as an exclusion for figures, not cards", () => {
    const koffing = makeItem({ name: "Koffing", itemNumber: "51", set: "Base" });
    expect(titleMatchesItem("Koffing 51/102 Base Set KO", koffing)).toBe(true);
  });
});

describe("numberAppearsInTitle", () => {
  it.each([
    ["4", "charizard 4/102 base", true],
    ["4", "charizard #4 base", true],
    ["4", "charizard 004/102", true],
    ["4", "charizard 14/102", false],
    ["4", "charizard 40/102", false],
    ["TG01", "pikachu tg01 lost origin", true],
    ["SWSH050", "pikachu swsh 050 promo", true],
  ])("number %s in '%s' -> %s", (num, title, expected) => {
    expect(numberAppearsInTitle(num, title)).toBe(expected);
  });
});

describe("removeOutliers / getMedianPrice", () => {
  it("leaves samples of fewer than 4 values alone", () => {
    expect(removeOutliers([1, 100, 1000])).toEqual([1, 100, 1000]);
  });

  it("drops values outside 1.5x the interquartile range", () => {
    const trimmed = removeOutliers([95, 100, 102, 98, 101, 99, 5000, 3]);
    expect(trimmed).not.toContain(5000);
    expect(trimmed).not.toContain(3);
    expect(trimmed).toContain(100);
  });

  it("computes the median for odd and even counts, rounded to cents", () => {
    expect(getMedianPrice([3, 1, 2])).toBe(2);
    expect(getMedianPrice([1, 2, 3, 4])).toBe(2.5);
    expect(getMedianPrice([1.111, 2.226])).toBe(1.67);
  });
});

describe("selectTcgPlayerPrice", () => {
  it("prefers the unlimited holofoil printing for holo rarities over 1st Edition", () => {
    const result = selectTcgPlayerPrice(
      { "1stEditionHolofoil": { market: 9000 }, holofoil: { market: 950 } },
      "Rare Holo"
    );
    expect(result).toEqual({ marketPrice: 950, confidence: "high" });
  });

  it("prefers the normal printing for non-holo rarities", () => {
    const result = selectTcgPlayerPrice(
      { normal: { market: 2 }, reverseHolofoil: { market: 6 } },
      "Common"
    );
    expect(result).toEqual({ marketPrice: 2, confidence: "high" });
  });

  it("falls back to mid price with medium confidence when no market price", () => {
    const result = selectTcgPlayerPrice({ holofoil: { market: null, mid: 120.456 } }, "Rare Holo");
    expect(result).toEqual({ marketPrice: 120.46, confidence: "medium" });
  });

  it("skips printings with no usable price and returns null when none have one", () => {
    expect(selectTcgPlayerPrice({ holofoil: { market: 0 }, normal: {} }, "Rare Holo")).toBeNull();
  });
});

describe("getItemKind", () => {
  it.each([
    [{ category: "card", game: "Gundam Card Game" }, "card"],
    [{ category: null, game: "Pokémon" }, "card"],
    [{ category: "video game", game: "SNES" }, "video-game"],
    [{ category: "console", game: "Nintendo" }, "video-game"],
    [{ category: "funko pop", game: "Funko" }, "figure"],
    [{ category: "miniature", game: "Warhammer 40,000" }, "figure"],
    [{ category: "comic", game: "Marvel" }, "comic"],
    [{ category: "sneakers", game: "Nike" }, "other"],
  ] as const)("%o -> %s", (fields, expected) => {
    expect(getItemKind(makeItem(fields))).toBe(expected);
  });
});
