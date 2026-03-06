-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "imageUrl" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "setCode" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT
);
INSERT INTO "new_Card" ("cardNumber", "game", "id", "imageUrl", "name", "rarity", "set", "setCode") SELECT "cardNumber", "game", "id", "imageUrl", "name", "rarity", "set", "setCode" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_game_idx" ON "Card"("game");
CREATE INDEX "Card_setCode_idx" ON "Card"("setCode");
CREATE INDEX "Card_name_idx" ON "Card"("name");
CREATE UNIQUE INDEX "Card_game_setCode_cardNumber_key" ON "Card"("game", "setCode", "cardNumber");
CREATE UNIQUE INDEX "Card_game_setCode_name_key" ON "Card"("game", "setCode", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
