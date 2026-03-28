/*
This file holds pricing provider logic.

Why this exists:
- keeps lib/prices.ts cleaner
- makes real API providers easier to add later
- lets OmniVault grow without turning one file into a mess
*/

export type PricingItem = {
  id: string;
  name: string;
  category: string | null;
  game: string | null;
  set: string | null;
};

export type PriceResult = {
  marketPrice: number;
  source: string;
};

/*
Main provider entry point.

Later this can try:
- TCGPlayer
- eBay
- PriceCharting

For now it returns simulated pricing.
*/
export async function getBestProviderPrice(
  item: PricingItem
): Promise<PriceResult | null> {
  // Future real provider example:
  // const tcgPlayerPrice = await getPriceFromTCGPlayer(item);
  // if (tcgPlayerPrice) return tcgPlayerPrice;

  return getSimulatedPrice(item);
}

/*
Temporary simulated provider.

This acts like a fake pricing API for now.
*/
function getSimulatedPrice(item: PricingItem): PriceResult {
  const name = item.name.toLowerCase();
  const game = (item.game ?? "").toLowerCase();
  const category = (item.category ?? "").toLowerCase();

  if (name.includes("blue eyes")) {
    return { marketPrice: 200.0, source: "simulated" };
  }

  if (name.includes("dark magician")) {
    return { marketPrice: 25.0, source: "simulated" };
  }

  if (name.includes("batman")) {
    return { marketPrice: 10.0, source: "simulated" };
  }

  if (name.includes("commander dante")) {
    return { marketPrice: 0.0, source: "simulated" };
  }

  if (game.includes("yu-gi-oh")) {
    return { marketPrice: 8.5, source: "simulated" };
  }

  if (game.includes("warhammer")) {
    return { marketPrice: 12.0, source: "simulated" };
  }

  if (category.includes("comic")) {
    return { marketPrice: 6.0, source: "simulated" };
  }

  return { marketPrice: 5.0, source: "simulated" };
}