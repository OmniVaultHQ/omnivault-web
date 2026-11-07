/*
Normalized catalog shapes used by importers.

Purpose:
- every source (Pokémon, One Piece, Gundam, etc.) can normalize
  its API data into one shared OmniVault format
- importers can then save that format into Prisma models
*/

export type NormalizedCatalogCollection = {
  /*
  Source info
  Example:
  - pokemon-tcg
  - one-piece
  */
  sourceKey: string;
  sourceName: string;
  sourceCategory?: string | null;

  /*
  Collection / set info
  */
  externalId?: string | null;
  name: string;
  code?: string | null;
  type?: string | null;
  releaseDate?: Date | null;
  imageUrl?: string | null;

  /*
  Flexible extra data from source APIs
  Example for Pokémon:
  - series
  - printedTotal
  - total
  */
  metadata?: Record<string, unknown> | null;
};

export type NormalizedCatalogItem = {
  /*
  External source IDs / links
  */
  externalId?: string | null;
  externalUrl?: string | null;

  /*
  Main display fields
  */
  name: string;
  category?: string | null;
  game: string;
  set: string;

  /*
  Common collectible fields
  */
  setCode?: string | null;
  itemNumber?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;

  /*
  Flexible extra data from source APIs
  */
  metadata?: Record<string, unknown> | null;
};

export type NormalizedCatalogImport = {
  collection: NormalizedCatalogCollection;
  items: NormalizedCatalogItem[];
};