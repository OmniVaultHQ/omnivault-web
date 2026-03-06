import { prisma } from "@/lib/prisma";

export async function getOrCreateDefaultCollection(userId: string) {
  let collection = await prisma.collection.findFirst({
    where: {
      userId,
      name: "Main",
    },
  });

  if (!collection) {
    collection = await prisma.collection.create({
      data: {
        userId,
        name: "Main",
      },
    });
  }

  return collection;
}