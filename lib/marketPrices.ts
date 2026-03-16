import { prisma } from "@/lib/prisma";

export async function updateMarketPrices() {

  const items = await prisma.userItem.findMany({
    include: {
      item: true
    }
  });

  for (const item of items) {

    // Temporary simulated pricing
    // Later this will come from TCGPlayer / eBay API
    const randomMarket = Number(
      (Math.random() * 200 + 5).toFixed(2)
    );

    await prisma.userItem.update({
      where: { id: item.id },
      data: {
        marketPrice: randomMarket
      }
    });

  }

}