"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function addToCollection(itemId: string, quantity = 1) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userId = session.user.id;

  const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;

  const existing = await prisma.userItem.findFirst({
    where: { userId, itemId },
  });

  if (existing) {
    await prisma.userItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + qty },
    });
  } else {
    await prisma.userItem.create({
      data: {
        userId,
        itemId,
        quantity: qty,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
}