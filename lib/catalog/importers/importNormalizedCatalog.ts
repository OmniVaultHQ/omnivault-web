import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormalizedCatalogImport } from "../types";

/*
Universal catalog importer.

Purpose:
- Saves ANY normalized catalog data into OmniVault
- Pokémon, Yu-Gi-Oh, Magic, comics, figures, etc. can all use this
- Source files only fetch/normalize data
- This file handles database saving
*/

function toPrismaJson(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function importNormalizedCatalog(normalized: NormalizedCatalogImport) {
  const source = await prisma.catalogSource.upsert({
    where: {
      key: normalized.collection.sourceKey,
    },
    update: {
      name: normalized.collection.sourceName,
      category: normalized.collection.sourceCategory ?? null,
    },
    create: {
      key: normalized.collection.sourceKey,
      name: normalized.collection.sourceName,
      category: normalized.collection.sourceCategory ?? null,
    },
  });

  const catalogExternalId =
    normalized.collection.externalId?.trim() ||
    normalized.collection.code?.trim() ||
    normalized.collection.name.trim();

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

  let importedCount = 0;

  for (const item of normalized.items) {
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
    collectionName: catalogCollection.name,
    importedCount,
  };
}