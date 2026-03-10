import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getOrCreateDefaultCollection } from "@/lib/collections";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const body = await req.json();
  const itemId = String(body.itemId ?? "");
  const quantity = Number(body.quantity ?? 1);

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const defaultCollection = await getOrCreateDefaultCollection(userId);
  const collectionId = String(body.collectionId ?? defaultCollection.id);

  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;

  await prisma.collectionItem.upsert({
    where: {
      collectionId_itemId: {
        collectionId,
        itemId,
      },
    },
    create: {
      userId,
      collectionId,
      itemId,
      quantity: safeQuantity,
    },
    update: {
      quantity: { increment: safeQuantity },
    },
  });

  return NextResponse.json({ ok: true });
}