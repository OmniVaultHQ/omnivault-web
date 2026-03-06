import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cardId = String(body?.cardId ?? "");
  const quantity = Math.max(1, Number(body?.quantity ?? 1));
  const collectionId = String(body?.collectionId ?? "");

  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  // pick a collection (requested or fallback to first)
  let targetCollectionId = collectionId;
  if (!targetCollectionId) {
    const first = await prisma.collection.findFirst({ where: { userId } });
    if (!first) {
      const created = await prisma.collection.create({ data: { userId, name: "Main" } });
      targetCollectionId = created.id;
    } else {
      targetCollectionId = first.id;
    }
  }

  // upsert item in that collection
  const existing = await prisma.collectionItem.findFirst({
    where: { collectionId: targetCollectionId, cardId },
  });

  if (existing) {
    await prisma.collectionItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.collectionItem.create({
      data: { userId, collectionId: targetCollectionId, cardId, quantity },
    });
  }

  return NextResponse.json({ ok: true });
}