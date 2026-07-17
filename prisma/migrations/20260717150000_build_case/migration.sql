-- CreateTable
CREATE TABLE "BuildCase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "builder" TEXT NOT NULL,
    "households" INTEGER,
    "street" TEXT,
    "sellingPeriod" TEXT,
    "permitNo" TEXT,
    "declareDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildCase_name_district_key" ON "BuildCase"("name", "district");

-- CreateIndex
CREATE INDEX "BuildCase_builder_idx" ON "BuildCase"("builder");

-- CreateIndex
CREATE INDEX "BuildCase_name_idx" ON "BuildCase"("name");
