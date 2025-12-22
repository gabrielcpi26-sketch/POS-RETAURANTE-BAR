-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT DEFAULT 'CASH';
ALTER TABLE "Order" ADD COLUMN "paymentRef" TEXT;
