/*
File: lib/price-providers.ts

Purpose:
- Central provider layer for market pricing
- Routes each catalog item to the provider most likely to price it correctly
- Returns null (instead of a wrong number) when no trustworthy price is found

Routing:
1. Pokémon cards with a Pokémon TCG API id  -> TCGplayer market price (via pokemontcg.io)
2. Anything else, or if step 1 has no price -> eBay Browse API, with strict listing filters
3. Simulated pricing                        -> ONLY when PRICING_ALLOW_SIMULATED=true (local dev)

Environment variables:
- EBAY_CLIENT_ID / EBAY_CLIENT_SECRET   (production keyset)
- EBAY_MARKETPLACE_ID=EBAY_US           (optional)
- POKEMON_TCG_API_KEY                   (optional, raises pokemontcg.io rate limits)
- PRICING_ALLOW_SIMULATED=true          (optional, dev only; never set in production)

Notes:
- Prices are for the catalog item as ungraded / near-mint. Per-condition and
  graded pricing would need pricing at the CollectionItem level (future work).
- eBay Browse returns ACTIVE listings (asking prices), not sold prices, so its
  results are marked lower confidence than TCGplayer market prices.
*/

export type PricingItem = {
  id: string;
  name: string;
  category: string | null;
  game: string | null;
  set: string | null;
  setCode: string | null;
  itemNumber: string | null;
  rarity: string | null;
  externalId: string | null;
  isCustom: boolean;
};

export type PriceConfidence = "high" | "medium" | "low";

export type PriceResult = {
  marketPrice: number;
  source: string; // tcgplayer | ebay | simulated
  confidence: PriceConfidence;
  sampleSize?: number;
  providerUpdatedAt?: string | null;
};

const REQUEST_TIMEOUT_MS = 10_000;

/* =========================================================
   PROVIDER REGISTRY
   ---------------------------------------------------------
   Each provider says which items it can price and how.
   getBestProviderPrice tries them in order and returns the
   first trustworthy result.

   To add a provider (e.g. PriceCharting for video games):
   1. write getXPrice(item) returning PriceResult | null
   2. add { id, supports, getPrice } to PRICE_PROVIDERS at the
      right priority
   3. give its source a trust level in lib/price-history.ts
   ========================================================= */

export type PriceProvider = {
  id: string;
  supports: (item: PricingItem) => boolean;
  getPrice: (item: PricingItem) => Promise<PriceResult | null>;
};

export const PRICE_PROVIDERS: PriceProvider[] = [
  {
    // TCGplayer market price via pokemontcg.io (needs the card's API id)
    id: "tcgplayer",
    supports: (item) => isPokemon(item) && Boolean(item.externalId),
    getPrice: getPokemonTcgPrice,
  },
  {
    // eBay active listings, any category with enough identifying info
    id: "ebay",
    supports: (item) => !item.isCustom && Boolean(item.name?.trim()),
    getPrice: getPriceFromEbay,
  },
];

export async function getBestProviderPrice(
  item: PricingItem
): Promise<PriceResult | null> {
  for (const provider of PRICE_PROVIDERS) {
    if (!provider.supports(item)) continue;
    const result = await provider.getPrice(item);
    if (result) return result;
  }

  if (process.env.PRICING_ALLOW_SIMULATED === "true") {
    return getSimulatedPrice(item);
  }

  console.warn(`[pricing] no trustworthy price for item ${item.id} (${item.name})`);
  return null;
}

function isPokemon(item: PricingItem): boolean {
  return normalize(item.game ?? "").includes("pokemon");
}

/* =========================================================
   POKÉMON TCG API -> TCGplayer market price
   ========================================================= */

type TcgVariantPrice = {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
};

type PokemonCardPriceResponse = {
  data?: {
    id: string;
    name: string;
    rarity?: string;
    tcgplayer?: {
      updatedAt?: string;
      prices?: Record<string, TcgVariantPrice | undefined>;
    };
  };
};

/*
Which TCGplayer variant to read. Unlimited/standard printings first, since
the catalog does not yet track 1st Edition or reverse holo as separate items.
*/
const HOLO_VARIANT_ORDER = [
  "holofoil",
  "unlimitedHolofoil",
  "normal",
  "reverseHolofoil",
  "1stEditionHolofoil",
  "1stEditionNormal",
];
const NON_HOLO_VARIANT_ORDER = [
  "normal",
  "holofoil",
  "unlimitedHolofoil",
  "reverseHolofoil",
  "1stEditionNormal",
  "1stEditionHolofoil",
];

async function getPokemonTcgPrice(item: PricingItem): Promise<PriceResult | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();
    if (apiKey) headers["X-Api-Key"] = apiKey;

    const url =
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(item.externalId!)}` +
      `?select=id,name,rarity,tcgplayer`;

    const doFetch = () =>
      fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

    // pokemontcg.io randomly returns 5xx on ~40% of calls (measured 2026-11-07),
    // so try up to 3 times with backoff before falling back to eBay.
    let response = await doFetch();
    for (const delayMs of [500, 1000]) {
      if (response.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      response = await doFetch();
    }

    if (!response.ok) {
      console.error("[pricing] pokemontcg.io error:", response.status, item.externalId);
      return null;
    }

    const json = (await response.json()) as PokemonCardPriceResponse;
    const prices = json.data?.tcgplayer?.prices;
    if (!prices) return null;

    const rarity = normalize(json.data?.rarity ?? item.rarity ?? "");
    const order = rarity.includes("holo") || rarity.includes("ultra") || rarity.includes("secret")
      ? HOLO_VARIANT_ORDER
      : NON_HOLO_VARIANT_ORDER;

    for (const variant of order) {
      const p = prices[variant];
      const value = p?.market ?? p?.mid ?? null;
      if (value != null && Number.isFinite(value) && value > 0) {
        return {
          marketPrice: roundPrice(value),
          source: "tcgplayer",
          confidence: p?.market != null ? "high" : "medium",
          providerUpdatedAt: json.data?.tcgplayer?.updatedAt ?? null,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[pricing] pokemontcg.io failure:", error);
    return null;
  }
}

/* =========================================================
   eBay Browse API
   ========================================================= */

// eBay category "CCG Individual Cards"
const EBAY_CCG_SINGLES_CATEGORY = "183454";
const EBAY_MIN_MATCHES = 3;

/*
Listing titles containing any of these are not a single, complete, authentic,
ungraded copy of the item. Split by category so e.g. "manual only" is caught
for video games without hurting card searches.
*/
type ItemKind = "card" | "video-game" | "figure" | "comic" | "other";

// Every category: multiples, fakes, damaged/partial items, graded copies
// (catalog prices are for ungraded copies)
const COMMON_EXCLUDED_TERMS = [
  "lot", "bundle", "bulk", "set of",
  "proxy", "custom", "replica", "fake", "reprint", "repro", "reproduction",
  "bootleg", "knockoff", "knock off", "counterfeit",
  "for parts", "parts only", "broken", "not working", "damaged",
  "empty", "box only", "case only", "manual only", "digital",
  "psa", "bgs", "cgc", "sgc", "beckett", "graded", "slab", "wata", "vga", "cbcs",
];

const KIND_EXCLUDED_TERMS: Record<ItemKind, string[]> = {
  card: [
    "complete set", "playset", "orica", "fan art", "metal card",
    "code card", "online code",
    "you pick", "you choose", "pick your", "choose your", "u pick",
    "sleeve only", "binder",
  ],
  "video-game": ["insert only", "label only", "artwork only", "cover only", "disc only"],
  figure: ["ko", "accessory only", "accessories only", "parts lot", "head only"],
  comic: ["facsimile", "cover only", "coverless"],
  other: [],
};

function getItemKind(item: PricingItem): ItemKind {
  const category = normalize(`${item.category ?? ""}`);
  if (isPokemon(item) || category.includes("card")) return "card";
  if (category.includes("video game") || category.includes("console") || category === "game" || category === "games") {
    return "video-game";
  }
  if (["figure", "statue", "funko", "model", "miniature"].some((k) => category.includes(k))) return "figure";
  if (category.includes("comic") || category.includes("manga")) return "comic";
  return "other";
}

function getExcludedTerms(item: PricingItem): string[] {
  return [...COMMON_EXCLUDED_TERMS, ...KIND_EXCLUDED_TERMS[getItemKind(item)]];
}

const LANGUAGE_TERMS = ["japanese", "japan", "korean", "chinese", "german", "french", "italian", "spanish"];

let ebayTokenCache: { accessToken: string; expiresAtMs: number } | null = null;

async function getPriceFromEbay(item: PricingItem): Promise<PriceResult | null> {
  try {
    const clientId = process.env.EBAY_CLIENT_ID?.trim();
    const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";

    if (!clientId || !clientSecret) return null;

    const query = buildEbayQuery(item);
    if (!query) return null;

    const accessToken = await getEbayApplicationToken(clientId, clientSecret);
    if (!accessToken) return null;

    const params = new URLSearchParams({
      q: query,
      limit: "50",
      filter: "buyingOptions:{FIXED_PRICE},priceCurrency:USD",
    });
    if (isCard(item)) params.set("category_ids", EBAY_CCG_SINGLES_CATEGORY);

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.error("[pricing] eBay search error:", response.status, await response.text());
      return null;
    }

    const json = (await response.json()) as EbaySearchResponse;
    const summaries = json.itemSummaries ?? [];

    const matched = summaries.filter((entry) => titleMatchesItem(entry.title ?? "", item));
    const prices = matched
      .map((entry) => Number(entry.price?.value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const trimmed = removeOutliers(prices);

    if (trimmed.length < EBAY_MIN_MATCHES) {
      console.warn("[pricing] eBay: too few matching listings", {
        item: item.name,
        query,
        returned: summaries.length,
        matched: trimmed.length,
      });
      return null;
    }

    return {
      marketPrice: getMedianPrice(trimmed),
      source: "ebay",
      // Active listings, not sold prices, so cap at "medium"
      confidence: trimmed.length >= 8 ? "medium" : "low",
      sampleSize: trimmed.length,
    };
  } catch (error) {
    console.error("[pricing] eBay failure:", error);
    return null;
  }
}

function isCard(item: PricingItem): boolean {
  return getItemKind(item) === "card";
}

/*
Query = name + number + set (+ game for TCGs).
Rarity is left out on purpose: sellers rarely write it the same way the
catalog does, and it hurts recall more than it helps precision.
*/
function buildEbayQuery(item: PricingItem): string {
  const pieces: string[] = [];
  if (item.name) pieces.push(item.name.trim());
  if (item.itemNumber) pieces.push(item.itemNumber.trim());
  if (item.set) pieces.push(item.set.trim());
  if (isPokemon(item)) pieces.push("Pokemon");
  else if (item.game) pieces.push(item.game.trim());

  return stripAccents(pieces.join(" ")).replace(/\s+/g, " ").trim();
}

/*
Decides whether an eBay listing title is the same collectible as the item.
*/
export function titleMatchesItem(rawTitle: string, item: PricingItem): boolean {
  const title = ` ${normalize(rawTitle)} `;
  if (!title.trim()) return false;

  // 1. Every meaningful word of the item name must appear
  const nameTokens = normalize(item.name)
    .split(" ")
    .filter((t) => t.length > 1 || /\d/.test(t));
  if (!nameTokens.every((token) => containsWord(title, token))) {
    return false;
  }

  // 2. Card number must appear, e.g. "4/102", "#4", "004", "TG01"
  if (item.itemNumber && !numberAppearsInTitle(item.itemNumber, title)) {
    return false;
  }

  // 3. No lots, fakes, partial/damaged items, graded copies (per category)
  if (getExcludedTerms(item).some((term) => containsWord(title, term))) {
    return false;
  }

  // 4. No foreign-language printings unless the set itself is one
  const setText = normalize(item.set ?? "");
  if (LANGUAGE_TERMS.some((lang) => containsWord(title, lang) && !setText.includes(lang))) {
    return false;
  }

  return true;
}

function numberAppearsInTitle(itemNumber: string, normalizedTitle: string): boolean {
  const num = normalize(itemNumber).replace(/\s+/g, "");
  if (!num) return true;

  // Pure numeric: allow leading zeros and "/total" or "#" around it
  if (/^\d+$/.test(num)) {
    const n = String(Number(num));
    const re = new RegExp(`(^|[^0-9])0*${n}([^0-9]|$)`);
    return re.test(normalizedTitle.replace(/\s+/g, " "));
  }

  // Alphanumeric (TG01, SWSH050, SV001...): plain contains, ignoring spaces
  return normalizedTitle.replace(/\s+/g, "").includes(num);
}

function containsWord(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

// Shared in-flight token request, so parallel refresh workers fetch one token
let ebayTokenRequest: Promise<string | null> | null = null;

async function getEbayApplicationToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  if (ebayTokenCache && ebayTokenCache.expiresAtMs > Date.now() + 60_000) {
    return ebayTokenCache.accessToken;
  }

  if (!ebayTokenRequest) {
    ebayTokenRequest = requestEbayApplicationToken(clientId, clientSecret).finally(() => {
      ebayTokenRequest = null;
    });
  }
  return ebayTokenRequest;
}

async function requestEbayApplicationToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const now = Date.now();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error("[pricing] eBay token error:", response.status, await response.text());
    return null;
  }

  const json = (await response.json()) as EbayTokenResponse;
  if (!json.access_token || !json.expires_in) return null;

  ebayTokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + json.expires_in * 1000,
  };
  return json.access_token;
}

/* =========================================================
   Simulated (dev only)
   ========================================================= */

function getSimulatedPrice(item: PricingItem): PriceResult {
  const name = item.name.toLowerCase();
  const set = (item.set ?? "").toLowerCase();

  let base = Math.random() * 20 + 1;
  if (name.includes("charizard")) base = 150 + Math.random() * 200;
  else if (name.includes("blastoise")) base = 80 + Math.random() * 120;
  else if (name.includes("pikachu")) base = 20 + Math.random() * 80;
  if (set.includes("base")) base *= 2;

  return { marketPrice: roundPrice(base), source: "simulated", confidence: "low" };
}

/* =========================================================
   Helpers
   ========================================================= */

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// lowercase, accents removed, punctuation (except / and #) turned into spaces
function normalize(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9/#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
Drop values outside 1.5x the interquartile range.
Only applied with 4+ values; smaller samples are returned as-is.
*/
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return sorted.filter((v) => v >= low && v <= high);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function getMedianPrice(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? roundPrice(sorted[mid])
    : roundPrice((sorted[mid - 1] + sorted[mid]) / 2);
}

function roundPrice(value: number) {
  return Number(value.toFixed(2));
}

type EbayTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

type EbaySearchResponse = {
  itemSummaries?: Array<{
    title?: string;
    price?: { value?: string; currency?: string };
  }>;
};
