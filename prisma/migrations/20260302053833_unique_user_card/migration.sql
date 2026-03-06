/*
  Warnings:

  - You are about to drop the column `purchasePrice` on the `UserCard` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserCard" ("cardId", "id", "quantity", "userId") SELECT "cardId", "id", "quantity", "userId" FROM "UserCard";
DROP TABLE "UserCard";
ALTER TABLE "new_UserCard" RENAME TO "UserCard";
CREATE UNIQUE INDEX "UserCard_userId_cardId_key" ON "UserCard"("userId", "cardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
