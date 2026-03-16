import { prisma } from "@/lib/prisma";

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
This function decides what price an item should have.

Right now this is still a test engine:
- it looks at the item's name
- it returns a simulated market price

Later we will replace this logic with real API calls.
*/
export async function getPriceForItem(
  itemId: string
): Promise<PriceResult | null> {
  // Load the item so we know what we are pricing
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

  const name = item.name.toLowerCase();
  const game = (item.game ?? "").toLowerCase();
  const category = (item.category ?? "").toLowerCase();

  /*
  Temporary pricing rules for testing.
  These are fake prices so we can test the engine safely.
  */
  if (name.includes("blue eyes")) {
    return {
      marketPrice: 200.0,
      source: "simulated",
    };
  }

  if (name.includes("dark magician")) {
    return {
      marketPrice: 25.0,
      source: "simulated",
    };
  }

  if (name.includes("batman")) {
    return {
      marketPrice: 10.0,
      source: "simulated",
    };
  }

  if (name.includes("commander dante")) {
    return {
      marketPrice: 0.0,
      source: "simulated",
    };
  }

  /*
  Optional category/game-based fallback pricing.
  This gives more realistic defaults than one flat number.
  */
  if (game.includes("yu-gi-oh")) {
    return {
      marketPrice: 8.5,
      source: "simulated",
    };
  }

  if (game.includes("warhammer")) {
    return {
      marketPrice: 12.0,
      source: "simulated",
    };
  }

  if (category.includes("comic")) {
    return {
      marketPrice: 6.0,
      source: "simulated",
    };
  }

  /*
  Default fallback price.
  This keeps the engine working for items
  that do not match our custom rules yet.
  */
  return {
    marketPrice: 5.0,
    source: "simulated",
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
  do not create a duplicate history row.
  */
  if (latestPrice && roundPrice(latestPrice.marketPrice) === nextPrice) {
    return {
      skipped: true,
      reason: "unchanged",
      latestPrice,
    };
  }

  // Save a new historical price row
  const savedPrice = await prisma.itemPrice.create({
    data: {
      itemId,
      marketPrice: nextPrice,
      source: result.source,
    },
  });

  return {
    skipped: false,
    savedPrice,
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