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
  const cardId = String(body.cardId ?? "");
  const quantity = Number(body.quantity ?? 1);

  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  const collectionId = body.collectionId;

  await prisma.collectionItem.upsert({
    where: {
      collectionId_cardId: {
        collectionId: collectionId,
        cardId,
      },
    },
    create: {
      userId,
      collectionId: collectionId,
      cardId,
      quantity,
    },
    update: {
      quantity: { increment: quantity },
    },
  });

  return NextResponse.json({ ok: true });
}