import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getOrCreateDefaultCollection } from "@/lib/collections";
import CatalogSearch from "@/app/components/CatalogSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
searchParams can arrive in different shapes depending on Next.js version.
This keeps TypeScript happy and avoids weird edge cases.
*/
type SearchParamsMaybePromise =
  | {
      cid?: string | string[];
      q?: string | string[];
    }
  | Promise<{
      cid?: string | string[];
      q?: string | string[];
    }>
  | undefined;

/*
Helper:
Turns a possible string/string[]/undefined into a clean single string.
*/
function readSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type Props = {
  searchParams?: SearchParamsMaybePromise;
};

export default async function CatalogPage({ searchParams }: Props) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  /*
  Always make sure the user has a default collection.
  We use this only as a fallback if no valid cid is provided.
  */
  const defaultCollection = await getOrCreateDefaultCollection(userId);

  /*
  Load all collections for the logged-in user.
  */
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  /*
  Resolve search params safely.
  */
  const resolvedSearchParams = searchParams
    ? await searchParams
    : undefined;

  const requestedCollectionId = readSingleParam(resolvedSearchParams?.cid);
  const defaultQuery = readSingleParam(resolvedSearchParams?.q);

  /*
  IMPORTANT:
  Only allow a collection ID if it actually belongs to this user.
  This prevents bad IDs and keeps the catalog tied to the right collection.
  */
  const validRequestedCollection = requestedCollectionId
    ? collections.find((collection) => collection.id === requestedCollectionId)
    : null;

  /*
  Final active collection:
  - use cid from URL if valid
  - otherwise fall back to the user's default collection
  */
  const activeCollectionId =
    validRequestedCollection?.id ?? defaultCollection.id;

  async function addItemToCollection(
    itemId: string,
    collectionId: string
  ): Promise<void> {
    "use server";

    const session = await auth();
    if (!session?.user?.id) return;

    /*
    Double-check the collection belongs to the logged-in user.
    Never trust client-passed collection IDs blindly.
    */
    const ownedCollection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    /*
    If the passed collection is missing or not owned by the user,
    fall back to that user's default collection instead of breaking.
    */
    const safeCollection =
      ownedCollection ??
      (await getOrCreateDefaultCollection(session.user.id));

    await prisma.collectionItem.upsert({
      where: {
        userId_itemId_collectionId: {
          userId: session.user.id,
          itemId,
          collectionId: safeCollection.id,
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
      },
      create: {
        userId: session.user.id,
        itemId,
        collectionId: safeCollection.id,
        quantity: 1,
      },
    });

    /*
    Revalidate both pages so the UI stays fresh after adding.
    */
    revalidatePath("/catalog");
    revalidatePath("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <CatalogSearch
        onAdd={addItemToCollection}
        collections={collections}
        activeCollectionId={activeCollectionId}
        defaultQuery={defaultQuery}
      />
    </div>
  );
}