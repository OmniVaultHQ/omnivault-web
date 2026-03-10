import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.item.findMany({
    where: {
      // optional: keep catalog clean (prevents manual/custom items showing up)
      isCustom: false,
      OR: [
        { name: { contains: q } },
        { set: { contains: q } },
        { game: { contains: q } },
        { setCode: { contains: q } },
        { itemNumber: { contains: q } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
    include: {
      prices: {
        orderBy: { lastUpdated: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      game: item.game,
      set: item.set,
      imageUrl: item.imageUrl ?? null,
      setCode: item.setCode ?? null,
      itemNumber: item.itemNumber ?? null,
      rarity: item.rarity ?? null,
      price: item.prices?.[0]?.marketPrice ?? null,
      lastUpdated: item.prices?.[0]?.lastUpdated ?? null,
    })),
  });
}