import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getOrCreateDefaultCollection } from "@/lib/collections";

/*
POST /api/collection/add

Purpose:
- Adds a catalog item into one of the user's collections
- If the item is already in that collection, increase the quantity
- If the user does not send a collectionId, use their default collection

Why this file matters:
- This is the main backend route your Catalog UI calls when the user clicks
  "Add to Collection"
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
  Read the request body from the frontend

  Expected body example:
  {
    itemId: "abc123",
    collectionId: "xyz789",   // optional
    quantity: 1               // optional
  }
  */
  const body = await req.json();

  const itemId = String(body.itemId ?? "");
  const quantity = Number(body.quantity ?? 1);

  /*
  Step 3:
  Validate required data
  */
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  /*
  Step 4:
  If no collection was provided, use the user's default collection
  */
  const defaultCollection = await getOrCreateDefaultCollection(userId);
  const collectionId = String(body.collectionId ?? defaultCollection.id);

  /*
  Step 5:
  Make sure quantity is always at least 1
  */
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;

  /*
  Step 6:
  Add or update the owned collection row

  IMPORTANT:
  Your schema uses this composite unique key on CollectionItem:
  @@unique([userId, itemId, collectionId])

  That means Prisma expects:
  userId_itemId_collectionId

  Why:
  - same user
  - same item
  - same collection
  should be treated as one owned row
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
  Step 7:
  Return success back to the frontend
  */
  return NextResponse.json({ ok: true });
}