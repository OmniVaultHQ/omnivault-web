-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN "purchasePrice" REAL;

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_cardId_idx" ON "CollectionItem"("cardId");
