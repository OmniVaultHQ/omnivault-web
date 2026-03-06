import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const cards = await prisma.card.findMany({
    where: {
      // optional: keep catalog clean (prevents your manual/custom cards showing up)
      isCustom: false,
      OR: [
        { name: { contains: q } },
        { set: { contains: q } },
        { game: { contains: q } },
        { setCode: { contains: q } },
        { cardNumber: { contains: q } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },

    // ✅ THIS is what fixes "prices does not exist"
    include: {
      prices: {
        orderBy: { lastUpdated: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    items: cards.map((c) => ({
      id: c.id,
      name: c.name,
      game: c.game,
      set: c.set,
      imageUrl: c.imageUrl ?? null,
      setCode: c.setCode ?? null,
      cardNumber: c.cardNumber ?? null,
      rarity: c.rarity ?? null,

      // ✅ safe because prices included (may still be empty)
      price: c.prices?.[0]?.marketPrice ?? null,
      lastUpdated: c.prices?.[0]?.lastUpdated ?? null,
    })),
  });
}