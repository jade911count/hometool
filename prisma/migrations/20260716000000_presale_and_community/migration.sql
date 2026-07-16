-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "buildingUnit" TEXT,
ADD COLUMN     "cancellation" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'sale',
ADD COLUMN     "projectName" TEXT;

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "avgUnitPricePerPing" INTEGER,
    "lastDealDate" TIMESTAMP(3),
    "households" INTEGER,
    "builder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Community_txCount_idx" ON "Community"("txCount");

-- CreateIndex
CREATE UNIQUE INDEX "Community_name_district_key" ON "Community"("name", "district");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- CreateIndex
CREATE INDEX "Transaction_projectName_idx" ON "Transaction"("projectName");
