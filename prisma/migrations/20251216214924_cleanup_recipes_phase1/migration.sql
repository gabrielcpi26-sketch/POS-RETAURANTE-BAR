/*
  Warnings:

  - You are about to drop the column `costPrice` on the `InventoryItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MenuRecipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "menuName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_InventoryItem" ("createdAt", "currentStock", "id", "name", "sku", "unit", "updatedAt") SELECT "createdAt", "currentStock", "id", "name", "sku", "unit", "updatedAt" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MenuRecipe_menuName_key" ON "MenuRecipe"("menuName");
