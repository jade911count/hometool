-- CreateTable
CREATE TABLE "CondoRegistry" (
    "id" TEXT NOT NULL,
    "licenseSerial" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgType" TEXT,
    "households" INTEGER,
    "district" TEXT NOT NULL,
    "boundClusterKey" TEXT,
    "boundAt" TIMESTAMP(3),
    "boundByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondoRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CondoRegistry_licenseSerial_name_key" ON "CondoRegistry"("licenseSerial", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CondoRegistry_boundClusterKey_key" ON "CondoRegistry"("boundClusterKey");

-- CreateIndex
CREATE INDEX "CondoRegistry_name_idx" ON "CondoRegistry"("name");

-- CreateIndex
CREATE INDEX "CondoRegistry_district_idx" ON "CondoRegistry"("district");
