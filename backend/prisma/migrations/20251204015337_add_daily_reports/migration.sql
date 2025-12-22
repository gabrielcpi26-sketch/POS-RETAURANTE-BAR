-- CreateTable
CREATE TABLE "DailyReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "totalSales" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_date_key" ON "DailyReport"("date");
