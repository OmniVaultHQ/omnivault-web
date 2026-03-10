-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "imageUrl" TEXT,
    "itemNumber" TEXT,
    "rarity" TEXT,
    "setCode" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT
);
INSERT INTO "new_Item" ("itemNumber", "game", "id", "imageUrl", "name", "rarity", "set", "setCode") SELECT "itemNumber", "game", "id", "imageUrl", "name", "rarity", "set", "setCode" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_game_idx" ON "Item"("game");
CREATE INDEX "Item_setCode_idx" ON "Item"("setCode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE UNIQUE INDEX "Item_game_setCode_itemNumber_key" ON "Item"("game", "setCode", "itemNumber");
CREATE UNIQUE INDEX "Item_game_setCode_name_key" ON "Item"("game", "setCode", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
