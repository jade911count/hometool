-- 一名冊綁多門牌：綁定關係從 CondoRegistry 單欄位移到 CommunityBinding 表
-- 既有綁定資料在此搬遷，不需人工重綁

-- AlterTable
ALTER TABLE "Community" ADD COLUMN "registryId" TEXT;

-- CreateTable
CREATE TABLE "CommunityBinding" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "clusterKey" TEXT NOT NULL,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boundByIp" TEXT,

    CONSTRAINT "CommunityBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityBinding_clusterKey_key" ON "CommunityBinding"("clusterKey");

-- CreateIndex
CREATE INDEX "CommunityBinding_registryId_idx" ON "CommunityBinding"("registryId");

-- CreateIndex
CREATE INDEX "Community_registryId_idx" ON "Community"("registryId");

-- AddForeignKey
ALTER TABLE "CommunityBinding" ADD CONSTRAINT "CommunityBinding_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "CondoRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 搬遷既有綁定（gen_random_uuid 為 PostgreSQL 13+ 內建）
INSERT INTO "CommunityBinding" ("id", "registryId", "clusterKey", "boundAt", "boundByIp")
SELECT gen_random_uuid()::text, "id", "boundClusterKey", COALESCE("boundAt", CURRENT_TIMESTAMP), "boundByIp"
FROM "CondoRegistry"
WHERE "boundClusterKey" IS NOT NULL;

-- 既有已綁定社區改掛 registryId（新模型：綁定後 clusterKey 歸空、由綁定表反查門牌）
UPDATE "Community" c
SET "registryId" = r."id", "clusterKey" = NULL
FROM "CondoRegistry" r
WHERE r."boundClusterKey" IS NOT NULL
  AND c."source" = 'address'
  AND c."clusterKey" = r."boundClusterKey";

-- DropIndex
DROP INDEX "CondoRegistry_boundClusterKey_key";

-- AlterTable
ALTER TABLE "CondoRegistry" DROP COLUMN "boundClusterKey",
DROP COLUMN "boundAt",
DROP COLUMN "boundByIp";
