-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN "purchasePrice" REAL;

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_itemId_idx" ON "CollectionItem"("itemId");
