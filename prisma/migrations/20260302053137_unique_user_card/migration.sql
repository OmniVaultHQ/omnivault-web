/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Card` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,cardId]` on the table `UserCard` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "game" TEXT NOT NULL
);
INSERT INTO "new_Card" ("game", "id", "name", "set") SELECT "game", "id", "name", "set" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE UNIQUE INDEX "Card_name_set_game_key" ON "Card"("name", "set", "game");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_userId_cardId_key" ON "UserCard"("userId", "cardId");
