import { prisma } from "@/lib/prisma";
import { getBestProviderPrice, type PriceResult } from "@/lib/price-providers";

/*
File: lib/prices.ts

Pricing engine entry points used by the rest of the app.

Safety rules before a price is saved:
- No provider result -> nothing is saved (old price stays)
- Simulated prices are never written unless PRICING_ALLOW_SIMULATED=true
- A low/medium-confidence price that jumps more than 5x up or down from the
  last saved real price is treated as a probable wrong match and rejected
*/

const MAX_JUMP_RATIO = 5;

// ItemPrice sources that are not real market data from a provider
const NON_PROVIDER_SOURCES = ["manual", "simulated", "estimated-rarity"];
const DEFAULT_STALE_HOURS = 12;
const DEFAULT_BATCH_LIMIT = 200;

function roundPrice(value: number) {
  return Number(value.toFixed(2));
}

export async function getPriceForItem(itemId: string): Promise<PriceResult | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      category: true,
      game: true,
      set: true,
      setCode: true,
      itemNumber: true,
      rarity: true,
      externalId: true,
      isCustom: true,
    },
  });

  if (!item) return null;

  const providerPrice = await getBestProviderPrice(item);
  if (!providerPrice) return null;

  return { ...providerPrice, marketPrice: roundPrice(providerPrice.marketPrice) };
}

export type SavePriceOutcome =
  | { status: "no-price" }
  | { status: "rejected"; reason: string; candidate: PriceResult; previous: number }
  | { status: "unchanged"; price: number; source: string; syncedRows: number }
  | { status: "saved"; price: number; source: string; syncedRows: number };

export async function savePriceForItem(itemId: string): Promise<SavePriceOutcome> {
  const result = await getPriceForItem(itemId);
  if (!result) return { status: "no-price" };

  const nextPrice = roundPrice(result.marketPrice);

  // Baseline = last price from a real provider. Older rows may hold manual,
  // simulated or rarity-guess values; those must not decide what is "suspicious".
  const latestPrice = await prisma.itemPrice.findFirst({
    where: { itemId, source: { notIn: NON_PROVIDER_SOURCES } },
    orderBy: { createdAt: "desc" },
    select: { marketPrice: true, source: true },
  });

  // Sanity guard against wrong matches
  if (
    latestPrice &&
    latestPrice.marketPrice > 0 &&
    result.confidence !== "high"
  ) {
    const ratio = nextPrice / latestPrice.marketPrice;
    if (ratio > MAX_JUMP_RATIO || ratio < 1 / MAX_JUMP_RATIO) {
      console.warn("[pricing] rejected suspicious price jump", {
        itemId,
        previous: latestPrice.marketPrice,
        candidate: nextPrice,
        source: result.source,
        confidence: result.confidence,
      });
      return {
        status: "rejected",
        reason: `price moved ${ratio.toFixed(2)}x from last saved value`,
        candidate: result,
        previous: latestPrice.marketPrice,
      };
    }
  }

  const priceChanged =
    !latestPrice ||
    roundPrice(latestPrice.marketPrice) !== nextPrice ||
    latestPrice.source !== result.source;

  if (priceChanged) {
    await prisma.itemPrice.create({
      data: { itemId, marketPrice: nextPrice, source: result.source },
    });
  }

  // Cache on the catalog item too
  await prisma.item.update({
    where: { id: itemId },
    data: { marketPrice: nextPrice },
  });

  // Sync unlocked owned rows (manualPriceLocked rows keep the user's value)
  const sync = await prisma.collectionItem.updateMany({
    where: { itemId, manualPriceLocked: false },
    data: {
      marketPrice: nextPrice,
      priceSource: result.source,
      lastPriceUpdated: new Date(),
    },
  });

  return {
    status: priceChanged ? "saved" : "unchanged",
    price: nextPrice,
    source: result.source,
    syncedRows: sync.count,
  };
}

export async function updatePricesForItems(itemIds: string[]) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  const results: Array<{ itemId: string; result: SavePriceOutcome | { status: "error"; message: string } }> = [];

  for (const itemId of uniqueIds) {
    try {
      results.push({ itemId, result: await savePriceForItem(itemId) });
    } catch (error) {
      results.push({
        itemId,
        result: { status: "error", message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  return results;
}

/*
Refresh only catalog items someone actually owns, and only if their owned rows
have not been priced in the last `staleHours`.

Why: after "import all Pokémon" the catalog has tens of thousands of items.
Pricing all of them every refresh would blow through eBay's daily call limit
and pokemontcg.io's rate limit for no benefit.
*/
export async function refreshStaleOwnedItems(options?: {
  userId?: string;
  staleHours?: number;
  limit?: number;
}) {
  const staleHours = options?.staleHours ?? DEFAULT_STALE_HOURS;
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  const rows = await prisma.collectionItem.findMany({
    where: {
      ...(options?.userId ? { userId: options.userId } : {}),
      manualPriceLocked: false,
      item: { isCustom: false },
      OR: [{ lastPriceUpdated: null }, { lastPriceUpdated: { lt: cutoff } }],
    },
    select: { itemId: true },
    distinct: ["itemId"],
    orderBy: { lastPriceUpdated: "asc" },
    take: limit,
  });

  const itemIds = rows.map((r) => r.itemId);
  const results = await updatePricesForItems(itemIds);

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.result.status] = (acc[r.result.status] ?? 0) + 1;
    return acc;
  }, {});

  return { checked: itemIds.length, summary, results };
}
