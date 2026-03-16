import { prisma } from "@/lib/prisma";

/*
=============================================================
GET PRICE CHANGE
-------------------------------------------------------------
Returns the difference between the most recent price and
the previous stored price for an item.

Used to show:
+ $5 (+3%)
- $2 (-1.5%)
=============================================================
*/

export async function getPriceChange(itemId: string) {
  const prices = await prisma.itemPrice.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (prices.length < 2) {
    return {
      change: 0,
      percent: 0,
    };
  }

  const latest = prices[0].marketPrice;
  const previous = prices[1].marketPrice;

  const change = latest - previous;

  const percent =
    previous === 0 ? 0 : (change / previous) * 100;

  return {
    change,
    percent,
  };
}