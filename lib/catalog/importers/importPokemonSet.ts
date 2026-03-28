import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPokemonSet } from "../sources/pokemon";

/*
Convert flexible importer metadata into something Prisma accepts
for Json fields.

Why this exists:
- TypeScript's Record<string, unknown> is not automatically accepted
  as Prisma JSON input
- Prisma wants JsonObject / JsonArray / JsonValue-compatible input
*/
function toPrismaJson(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

/*
Imports one Pokémon set into OmniVault's master catalog tables.

What this does:
1. Fetches the set from the Pokémon API
2. Creates or updates the catalog source
3. Creates or updates the catalog collection
4. Upserts each card into the Item table

This is safe to run multiple times because it uses upsert.
*/
export async function importPokemonSet(setCode: string) {
  const normalized = await fetchPokemonSet(setCode);

  /*
  Step 1: Make sure the source exists
  */
  const source = await prisma.catalogSource.upsert({
    where: {
      key: normalized.collection.sourceKey,
    },
    update: {
      name: normalized.collection.sourceName,
      category: normalized.collection.sourceCategory,
      description: "Imported from the Pokémon TCG API",
    },
    create: {
      key: normalized.collection.sourceKey,
      name: normalized.collection.sourceName,
      category: normalized.collection.sourceCategory,
      description: "Imported from the Pokémon TCG API",
    },
  });

   /*
  Step 2: Create or update the catalog collection/set

  IMPORTANT:
  Prisma requires sourceId_externalId.externalId to be a real string.
  For Pokémon imports, this should always exist because it comes from setInfo.id.
  */
  const catalogExternalId = normalized.collection.externalId?.trim();

  if (!catalogExternalId) {
    throw new Error("Pokémon import is missing collection externalId.");
  }

  const catalogCollection = await prisma.catalogCollection.upsert({
    where: {
      sourceId_externalId: {
        sourceId: source.id,
        externalId: catalogExternalId,
      },
    },
    update: {
      name: normalized.collection.name,
      code: normalized.collection.code ?? null,
      type: normalized.collection.type ?? null,
      releaseDate: normalized.collection.releaseDate ?? null,
      imageUrl: normalized.collection.imageUrl ?? null,
      metadata: toPrismaJson(normalized.collection.metadata),
    },
    create: {
      sourceId: source.id,
      externalId: catalogExternalId,
      name: normalized.collection.name,
      code: normalized.collection.code ?? null,
      type: normalized.collection.type ?? null,
      releaseDate: normalized.collection.releaseDate ?? null,
      imageUrl: normalized.collection.imageUrl ?? null,
      metadata: toPrismaJson(normalized.collection.metadata),
    },
  });

  /*
  Step 3: Upsert all items/cards into the Item table
  */
  let importedCount = 0;

  for (const item of normalized.items) {
    /*
    Our main matching rule:
    - game + setCode + itemNumber

    Why:
    - Pokémon cards normally have stable set code + card number
    - this is stronger than name alone
    */
    await prisma.item.upsert({
      where: {
        game_setCode_itemNumber: {
          game: item.game,
          setCode: item.setCode ?? "",
          itemNumber: item.itemNumber ?? "",
        },
      },
      update: {
        catalogCollectionId: catalogCollection.id,
        category: item.category ?? null,
        name: item.name,
        set: item.set,
        game: item.game,
        imageUrl: item.imageUrl ?? null,
        itemNumber: item.itemNumber ?? null,
        rarity: item.rarity ?? null,
        setCode: item.setCode ?? null,
        externalId: item.externalId ?? null,
        externalUrl: item.externalUrl ?? null,
        metadata: toPrismaJson(item.metadata),
        isCustom: false,
        createdByUserId: null,
      },
      create: {
        catalogCollectionId: catalogCollection.id,
        category: item.category ?? null,
        name: item.name,
        set: item.set,
        game: item.game,
        imageUrl: item.imageUrl ?? null,
        itemNumber: item.itemNumber ?? null,
        rarity: item.rarity ?? null,
        setCode: item.setCode ?? null,
        externalId: item.externalId ?? null,
        externalUrl: item.externalUrl ?? null,
        metadata: toPrismaJson(item.metadata),
        isCustom: false,
        createdByUserId: null,
      },
    });

    importedCount += 1;
  }

  return {
    sourceId: source.id,
    catalogCollectionId: catalogCollection.id,
    setCode: normalized.collection.code ?? null,
    setName: catalogCollection.name,
    importedCount,
  };
}