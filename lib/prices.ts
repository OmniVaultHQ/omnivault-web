import { prisma } from "@/lib/prisma";
import { getBestProviderPrice, type PriceResult } from "@/lib/price-providers";
import {
  NON_PROVIDER_SOURCES,
  SOURCE_TRUST,
  TRUSTED_PRICE_MAX_AGE_MS,
  getSourceTrust,
} from "@/lib/price-history";

/*
File: lib/prices.ts

Pricing engine entry points used by the rest of the app.

Safety rules before a price is saved:
- No provider result -> nothing is saved (old price stays)
- Simulated prices are never written unless PRICING_ALLOW_SIMULATED=true
- A low/medium-confidence price that jumps more than 5x up or down from the
  last saved real price is treated as a probable wrong match and rejected
- A TCGplayer price from the last 7 days is never replaced by an eBay price
  (provider outage != price change)
*/

const MAX_JUMP_RATIO = 5;

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
  | { status: "saved"; price: number; source: string; syncedRows: number }
  | { status: "kept"; price: number; source: string; reason: string; syncedRows: number };

export async function savePriceForItem(itemId: string): Promise<SavePriceOutcome> {
  const result = await getPriceForItem(itemId);
  if (!result) return { status: "no-price" };

  const nextPrice = roundPrice(result.marketPrice);

  /*
  Don't downgrade: if a more trusted source (e.g. TCGplayer) priced this item
  recently, a weaker source (e.g. eBay asking prices) does not replace it just
  because the trusted provider had a temporary outage. The trusted price stays,
  with its real "last updated" time so the UI shows how old it is.
  */
  const resultTrust = getSourceTrust(result.source);
  const trustedCutoff = new Date(Date.now() - TRUSTED_PRICE_MAX_AGE_MS);
  const moreTrustedSources = Object.keys(SOURCE_TRUST).filter(
    (source) => getSourceTrust(source) > resultTrust
  );

  if (moreTrustedSources.length > 0) {
    const recentTrusted = await prisma.itemPrice.findFirst({
      where: {
        itemId,
        source: { in: moreTrustedSources },
        lastUpdated: { gte: trustedCutoff },
      },
      orderBy: { lastUpdated: "desc" },
      select: { marketPrice: true, source: true, lastUpdated: true },
    });

    if (recentTrusted) {
      console.warn("[pricing] kept recent trusted price instead of weaker source", {
        itemId,
        kept: `${recentTrusted.marketPrice} (${recentTrusted.source})`,
        candidate: `${nextPrice} (${result.source})`,
      });

      await prisma.item.update({
        where: { id: itemId },
        data: { marketPrice: recentTrusted.marketPrice },
      });

      const sync = await prisma.collectionItem.updateMany({
        where: { itemId, manualPriceLocked: false },
        data: {
          marketPrice: recentTrusted.marketPrice,
          priceSource: recentTrusted.source,
          lastPriceUpdated: recentTrusted.lastUpdated,
        },
      });

      return {
        status: "kept",
        price: recentTrusted.marketPrice,
        source: recentTrusted.source,
        reason: `${result.source} result ignored; ${recentTrusted.source} price from ${recentTrusted.lastUpdated.toISOString()} is still recent`,
        syncedRows: sync.count,
      };
    }
  }

  // Baseline = last price from a real provider. Older rows may hold manual,
  // simulated or rarity-guess values; those must not decide what is "suspicious".
  const latestPrice = await prisma.itemPrice.findFirst({
    where: { itemId, source: { notIn: NON_PROVIDER_SOURCES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, marketPrice: true, source: true },
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
  } else if (latestPrice) {
    // Same price confirmed again: bump lastUpdated (@updatedAt) so we know
    // this price is still current without adding a duplicate history row.
    await prisma.itemPrice.update({
      where: { id: latestPrice.id },
      data: { marketPrice: nextPrice },
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
