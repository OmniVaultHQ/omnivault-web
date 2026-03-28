-- DropIndex
DROP INDEX "CollectionItem_userId_idx";

-- DropIndex
DROP INDEX "CollectionItem_itemId_idx";

-- DropIndex
DROP INDEX "CollectionItem_collectionId_idx";

-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN "condition" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN "lastPriceUpdated" DATETIME;
ALTER TABLE "CollectionItem" ADD COLUMN "notes" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN "priceSource" TEXT;

-- AlterTable
ALTER TABLE "CustomItem" ADD COLUMN "lastPriceUpdated" DATETIME;
ALTER TABLE "CustomItem" ADD COLUMN "priceSource" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "marketPrice" REAL;
ALTER TABLE "Item" ADD COLUMN "purchasePrice" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ItemPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "marketPrice" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" DATETIME NOT NULL,
    CONSTRAINT "ItemPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ItemPrice" ("id", "itemId", "lastUpdated", "marketPrice") SELECT "id", "itemId", "lastUpdated", "marketPrice" FROM "ItemPrice";
DROP TABLE "ItemPrice";
ALTER TABLE "new_ItemPrice" RENAME TO "ItemPrice";
CREATE INDEX "ItemPrice_itemId_idx" ON "ItemPrice"("itemId");
CREATE INDEX "ItemPrice_source_idx" ON "ItemPrice"("source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
