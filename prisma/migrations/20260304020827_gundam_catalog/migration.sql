/*
  Warnings:

  - A unique constraint covering the columns `[game,cardNumber]` on the table `Card` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Card" ADD COLUMN "cardNumber" TEXT;
ALTER TABLE "Card" ADD COLUMN "rarity" TEXT;
ALTER TABLE "Card" ADD COLUMN "setCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Card_game_cardNumber_key" ON "Card"("game", "cardNumber");
