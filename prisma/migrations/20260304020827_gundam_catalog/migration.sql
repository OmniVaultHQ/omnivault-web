/*
  Warnings:

  - A unique constraint covering the columns `[game,itemNumber]` on the table `Item` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN "itemNumber" TEXT;
ALTER TABLE "Item" ADD COLUMN "rarity" TEXT;
ALTER TABLE "Item" ADD COLUMN "setCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Item_game_itemNumber_key" ON "Item"("game", "itemNumber");
