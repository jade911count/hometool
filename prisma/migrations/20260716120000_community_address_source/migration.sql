-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "clusterKey" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'presale';

-- CreateIndex
CREATE INDEX "Community_clusterKey_idx" ON "Community"("clusterKey");
