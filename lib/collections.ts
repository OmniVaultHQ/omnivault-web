import { prisma } from "@/lib/prisma";

/*
Get or create the default "Main" collection safely

Why this exists:
- Every user should always have a default collection
- We must NOT crash if it already exists
- We must handle race conditions safely
*/

export async function getOrCreateDefaultCollection(userId: string) {
  /*
  Step 1:
  Try to find existing "Main" collection
  */
  const existing = await prisma.collection.findFirst({
    where: {
      userId,
      name: "Main",
    },
  });

  if (existing) {
    return existing;
  }

  /*
  Step 2:
  If not found, create it

  We wrap in try/catch because:
  - another request might create it at the same time
  - this prevents crashes from unique constraint errors
  */
  try {
    return await prisma.collection.create({
      data: {
        userId,
        name: "Main",
      },
    });
  } catch (error) {
    /*
    Step 3:
    If creation failed (likely duplicate), fetch again
    */
    return await prisma.collection.findFirstOrThrow({
      where: {
        userId,
        name: "Main",
      },
    });
  }
}