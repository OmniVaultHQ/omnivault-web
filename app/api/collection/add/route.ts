import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/*
POST /api/collection/add

Purpose:
- Adds a catalog item into one of the user's collections
- If the item is already in that collection, increase the quantity
- REQUIRES the frontend to send collectionId
- Prevents silent fallback to Main/default collection

Why this matters:
- The active collection should always be explicit
- If collectionId is missing, that is a frontend bug
- We want to fail loudly instead of adding to the wrong collection
*/
export async function POST(req: Request) {
  /*
  Step 1:
  Make sure the user is signed in
  */
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  /*
  Step 2:
  Read request body
  Expected body:
  {
    itemId: "abc123",
    collectionId: "xyz789",
    quantity: 1
  }
  */
  const body = await req.json();

  const itemId = String(body.itemId ?? "").trim();
  const collectionId = String(body.collectionId ?? "").trim();
  const quantity = Number(body.quantity ?? 1);

  /*
  Step 3:
  Validate required fields
  */
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  if (!collectionId) {
    return NextResponse.json(
      { error: "Missing collectionId" },
      { status: 400 }
    );
  }

  /*
  Step 4:
  Make sure the collection belongs to this user

  This prevents:
  - invalid collection ids
  - adding to someone else's collection
  - hidden bugs from bad frontend state
  */
  const collection = await prisma.collection.findFirst({
    where: {
      id: collectionId,
      userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    );
  }

  /*
  Step 5:
  Make sure the item exists
  */
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  /*
  Step 6:
  Make sure quantity is always at least 1
  */
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;

  /*
  Step 7:
  Upsert the collection row

  Your schema uses:
  @@unique([userId, itemId, collectionId])

  That means Prisma expects:
  userId_itemId_collectionId
  */
  await prisma.collectionItem.upsert({
    where: {
      userId_itemId_collectionId: {
        userId,
        itemId,
        collectionId,
      },
    },
    create: {
      userId,
      collectionId,
      itemId,
      quantity: safeQuantity,
    },
    update: {
      quantity: {
        increment: safeQuantity,
      },
    },
  });

  /*
  Step 8:
  Return useful success data to the frontend

  This helps the UI show:
  - Added item name
  - Which collection it went into
  - Quantity added
  */
  return NextResponse.json({
    ok: true,
    itemId: item.id,
    itemName: item.name,
    collectionId: collection.id,
    collectionName: collection.name,
    quantityAdded: safeQuantity,
  });
}