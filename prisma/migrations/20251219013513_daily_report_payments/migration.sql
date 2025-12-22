/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `DailyReport` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "totalSales" REAL NOT NULL,
    "cashTotal" REAL NOT NULL DEFAULT 0,
    "cardTotal" REAL NOT NULL DEFAULT 0,
    "transferTotal" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_DailyReport" ("createdAt", "date", "id", "totalOrders", "totalSales") SELECT "createdAt", "date", "id", "totalOrders", "totalSales" FROM "DailyReport";
DROP TABLE "DailyReport";
ALTER TABLE "new_DailyReport" RENAME TO "DailyReport";
CREATE UNIQUE INDEX "DailyReport_date_key" ON "DailyReport"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
