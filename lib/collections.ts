import { prisma } from "@/lib/prisma";

/*
Ensures every user always has a default "Main" collection.

Flow:
1. Look for an existing collection named "Main"
2. If it exists → return it
3. If not → create it
*/
export async function getOrCreateDefaultCollection(userId: string) {
  // Try to find an existing default collection
  const existing = await prisma.collection.findFirst({
    where: {
      userId,
      name: "Main",
    },
  });

  if (existing) {
    return existing;
  }

  // Create the default collection if it doesn't exist
  return prisma.collection.create({
    data: {
      userId,
      name: "Main",
    },
  });
}