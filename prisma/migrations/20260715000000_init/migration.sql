-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Transaction" (
    "serialNo" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '臺中市',
    "district" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddress" TEXT,
    "landArea" DOUBLE PRECISION,
    "zoning" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "transactionItems" TEXT,
    "floor" TEXT,
    "totalFloors" INTEGER,
    "buildingType" TEXT,
    "mainUse" TEXT,
    "buildingMaterial" TEXT,
    "completionDate" TIMESTAMP(3),
    "buildingArea" DOUBLE PRECISION,
    "rooms" INTEGER,
    "halls" INTEGER,
    "baths" INTEGER,
    "compartmented" BOOLEAN,
    "hasManagement" BOOLEAN,
    "totalPrice" BIGINT NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "parkingType" TEXT,
    "parkingArea" DOUBLE PRECISION,
    "parkingPrice" BIGINT,
    "note" TEXT,
    "mainBuildingArea" DOUBLE PRECISION,
    "auxBuildingArea" DOUBLE PRECISION,
    "balconyArea" DOUBLE PRECISION,
    "hasElevator" BOOLEAN,
    "season" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geoPrecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("serialNo")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "query" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precision" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'nominatim',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE INDEX "Transaction_district_idx" ON "Transaction"("district");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_buildingType_idx" ON "Transaction"("buildingType");

-- CreateIndex
CREATE INDEX "Transaction_latitude_longitude_idx" ON "Transaction"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Transaction_season_idx" ON "Transaction"("season");

-- CreateIndex
CREATE INDEX "Transaction_normalizedAddress_idx" ON "Transaction"("normalizedAddress");
