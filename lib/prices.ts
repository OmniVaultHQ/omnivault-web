import { prisma } from "@/lib/prisma";
import { getBestProviderPrice } from "@/lib/price-providers";

/*
A single price result returned by the pricing engine.

marketPrice:
- the current market value we want to save

source:
- where the price came from
- examples: simulated, tcgplayer, ebay, pricecharting
*/
type PriceResult = {
  marketPrice: number;
  source: string;
};

/*
Small helper:
Round prices to 2 decimals so comparisons stay clean.
*/
function roundPrice(value: number) {
  return Number(value.toFixed(2));
}



/*
MAIN PRICE ENGINE ENTRY POINT

This is the only function the rest of the app should call.

Flow:
1. Load item
2. Try real providers (not connected yet)
3. Fall back to simulated pricing
*/
export async function getPriceForItem(
  itemId: string
): Promise<PriceResult | null> {
  // Load the catalog item so we know what we are pricing
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      category: true,
      game: true,
      set: true,
    },
  });

  // If item does not exist, stop here
  if (!item) return null;

  /*
  Ask provider layer for the best available price.
  That file now handles simulated pricing too.
  */
  const providerPrice = await getBestProviderPrice(item);

  // If no provider returned a price, stop here
  if (!providerPrice) return null;

  return {
    marketPrice: roundPrice(providerPrice.marketPrice),
    source: providerPrice.source,
  };
}

  





/*
This function writes a fresh price row into ItemPrice
ONLY if the price actually changed.

Why this matters:
- keeps history cleaner
- avoids duplicate chart points
- prepares the app for real pricing APIs
*/
export async function savePriceForItem(itemId: string) {
  // Ask the engine what the current price should be
  const result = await getPriceForItem(itemId);

  // If no price result came back, stop
  if (!result) return null;

  const nextPrice = roundPrice(result.marketPrice);

  // Check the most recent saved price for this item
  const latestPrice = await prisma.itemPrice.findFirst({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      marketPrice: true,
      source: true,
      createdAt: true,
    },
  });

  /*
  If the newest saved price is the same as the next price,
  we do not need another history row.
  BUT we still want unlocked collection rows to have:
  - latest marketPrice
  - latest priceSource
  - latest lastPriceUpdated
  */
  const priceChanged =
    !latestPrice || roundPrice(latestPrice.marketPrice) !== nextPrice;

  // Save a new historical price row only when the price changed
  let savedPrice: null | {
    id: string;
    marketPrice: number;
    source: string;
    createdAt: Date;
    lastUpdated: Date;
    itemId: string;
  } = null;

  if (priceChanged) {
    savedPrice = await prisma.itemPrice.create({
      data: {
        itemId,
        marketPrice: nextPrice,
        source: result.source,
      },
    });
  }

  /*
  IMPORTANT:
  Update only UNLOCKED owned collection rows for this item.

  Why:
  - manualPriceLocked = true means the user explicitly wants
    to keep their manual market price
  - refresh should not overwrite those rows
  */
  const now = new Date();

  const syncResult = await prisma.collectionItem.updateMany({
    where: {
      itemId,
      manualPriceLocked: false,
    },
    data: {
      marketPrice: nextPrice,
      priceSource: result.source,
      lastPriceUpdated: now,
    },
  });

  /*
  Return a useful result object so debugging stays easy.
  */
  if (!priceChanged) {
    return {
      skipped: true,
      reason: "unchanged-history-row",
      latestPrice,
      syncedCollectionRows: true,
      syncedUnlockedRowCount: syncResult.count,
    };
  }

  return {
    skipped: false,
    savedPrice,
    syncedCollectionRows: true,
    syncedUnlockedRowCount: syncResult.count,
  };
}

/*
This function updates prices for many items.

Used for:
- dashboard refresh button
- future cron jobs
- background refreshes
*/
export async function updatePricesForItems(itemIds: string[]) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  const results = [];

  for (const itemId of uniqueIds) {
    const saved = await savePriceForItem(itemId);
    results.push({
      itemId,
      result: saved,
    });
  }

  return results;
}