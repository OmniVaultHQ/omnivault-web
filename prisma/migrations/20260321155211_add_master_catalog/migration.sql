-- CreateTable
CREATE TABLE "CatalogSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT,
    "releaseDate" DATETIME,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogCollection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "catalogCollectionId" TEXT,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "imageUrl" TEXT,
    "itemNumber" TEXT,
    "rarity" TEXT,
    "setCode" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "metadata" JSONB,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "purchasePrice" REAL,
    "marketPrice" REAL,
    CONSTRAINT "Item_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("category", "createdByUserId", "game", "id", "imageUrl", "isCustom", "itemNumber", "marketPrice", "name", "purchasePrice", "rarity", "set", "setCode") SELECT "category", "createdByUserId", "game", "id", "imageUrl", "isCustom", "itemNumber", "marketPrice", "name", "purchasePrice", "rarity", "set", "setCode" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_catalogCollectionId_idx" ON "Item"("catalogCollectionId");
CREATE INDEX "Item_game_idx" ON "Item"("game");
CREATE INDEX "Item_setCode_idx" ON "Item"("setCode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE INDEX "Item_externalId_idx" ON "Item"("externalId");
CREATE UNIQUE INDEX "Item_game_setCode_itemNumber_key" ON "Item"("game", "setCode", "itemNumber");
CREATE UNIQUE INDEX "Item_game_setCode_name_key" ON "Item"("game", "setCode", "name");
CREATE UNIQUE INDEX "Item_name_set_game_key" ON "Item"("name", "set", "game");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSource_key_key" ON "CatalogSource"("key");

-- CreateIndex
CREATE INDEX "CatalogSource_category_idx" ON "CatalogSource"("category");

-- CreateIndex
CREATE INDEX "CatalogCollection_sourceId_idx" ON "CatalogCollection"("sourceId");

-- CreateIndex
CREATE INDEX "CatalogCollection_name_idx" ON "CatalogCollection"("name");

-- CreateIndex
CREATE INDEX "CatalogCollection_code_idx" ON "CatalogCollection"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollection_sourceId_externalId_key" ON "CatalogCollection"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollection_sourceId_name_code_key" ON "CatalogCollection"("sourceId", "name", "code");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_itemId_idx" ON "CollectionItem"("itemId");
