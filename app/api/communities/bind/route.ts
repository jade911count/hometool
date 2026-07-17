// 名冊綁定端點：把官方名冊（公寓大廈報備）社區綁到中古門牌社區
// POST   /api/communities/bind { registryId, communityId }
//   首綁 → 該門牌社區就地改名（獲得名稱＋戶數）
//   名冊已有其他門牌 → 此門牌併入既有社區（多棟合併），統計重算
// DELETE /api/communities/bind { registryId, clusterKey }
//   解除單一門牌：該門牌還原為獨立的門牌代稱社區；名冊已無門牌時社區就地還原
// 未登入階段開放操作：記錄 IP＋時間供回溯，並以 IP 做簡易頻率限制

import { prisma } from "@/lib/prisma";
import { addressAlias, computeAddressCommunityStats } from "@/lib/community";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30; // 每 IP 每小時綁定/解綁上限

const rateLog = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  rateLog.set(ip, recent);
  return false;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return Response.json({ error: "操作過於頻繁，請稍後再試" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const registryId = body?.registryId as string | undefined;
  const communityId = body?.communityId as string | undefined;
  if (!registryId || !communityId) {
    return Response.json({ error: "registryId 與 communityId 必填" }, { status: 400 });
  }

  const [registry, community] = await Promise.all([
    prisma.condoRegistry.findUnique({
      where: { id: registryId },
      include: { bindings: true },
    }),
    prisma.community.findUnique({ where: { id: communityId } }),
  ]);
  if (!registry || !community) {
    return Response.json({ error: "名冊或社區不存在" }, { status: 404 });
  }
  if (community.source !== "address") {
    return Response.json({ error: "只有中古門牌社區可以綁定名冊" }, { status: 400 });
  }
  if (community.registryId === registry.id) {
    return Response.json({ ok: true, communityId: community.id, name: registry.name }); // 冪等
  }
  if (community.registryId) {
    return Response.json(
      { error: "此社區已綁定其他名冊，請先解除" },
      { status: 409 }
    );
  }
  if (!community.clusterKey) {
    return Response.json({ error: "此社區缺少分群鍵，無法綁定" }, { status: 400 });
  }
  const clusterKey = community.clusterKey;

  // 名冊已有門牌 → 找出合併社區條目，把此門牌併進去
  const merged = registry.bindings.length
    ? await prisma.community.findFirst({
        where: { registryId: registry.id, source: "address" },
      })
    : null;

  try {
    const targetId = await prisma.$transaction(async (tx) => {
      await tx.communityBinding.create({
        data: {
          registryId: registry.id,
          clusterKey,
          boundByIp: ip,
        },
      });

      if (!merged) {
        // 首綁：門牌社區就地改名（保留原列 id，使用者所在頁不失效）
        await tx.community.update({
          where: { id: community.id },
          data: {
            name: registry.name,
            households: registry.households,
            registryId: registry.id,
            clusterKey: null,
          },
        });
        return community.id;
      }

      // 併入：刪除此門牌的獨立條目，重算合併條目統計
      const keys = [...registry.bindings.map((b) => b.clusterKey), clusterKey];
      const stats = await computeAddressCommunityStats(keys);
      await tx.community.delete({ where: { id: community.id } });
      await tx.community.update({ where: { id: merged.id }, data: stats });
      return merged.id;
    });
    return Response.json({ ok: true, communityId: targetId, name: registry.name });
  } catch (e) {
    // Community 有 (name, district) 唯一鍵：名冊名稱撞到同區既有社區（例如同名預售案）
    if (isUniqueViolation(e)) {
      return Response.json(
        { error: `同區已有名為「${registry.name}」的社區，無法綁定` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return Response.json({ error: "操作過於頻繁，請稍後再試" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const registryId = body?.registryId as string | undefined;
  const clusterKey = body?.clusterKey as string | undefined;
  if (!registryId || !clusterKey) {
    return Response.json({ error: "registryId 與 clusterKey 必填" }, { status: 400 });
  }

  const binding = await prisma.communityBinding.findUnique({
    where: { clusterKey },
  });
  if (!binding || binding.registryId !== registryId) {
    return Response.json({ ok: true }); // 未綁定，冪等
  }

  const merged = await prisma.community.findFirst({
    where: { registryId, source: "address" },
  });
  const remaining = await prisma.communityBinding.findMany({
    where: { registryId, clusterKey: { not: clusterKey } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.communityBinding.delete({ where: { id: binding.id } });

    if (!merged) return; // 社區列不存在（尚未 rebuild 等異常）：解除綁定即可

    if (remaining.length === 0) {
      // 最後一個門牌：合併條目就地還原為門牌代稱社區（保留 id）
      const stats = await computeAddressCommunityStats([clusterKey]);
      await tx.community.update({
        where: { id: merged.id },
        data: {
          ...stats,
          name: addressAlias(clusterKey, merged.district),
          clusterKey,
          registryId: null,
          households: null,
        },
      });
      return;
    }

    // 還有其他門牌：被解除的門牌另立獨立條目，合併條目統計重算
    const removedStats = await computeAddressCommunityStats([clusterKey]);
    await tx.community.create({
      data: {
        ...removedStats,
        name: addressAlias(clusterKey, merged.district),
        district: merged.district,
        source: "address",
        clusterKey,
      },
    });
    const mergedStats = await computeAddressCommunityStats(
      remaining.map((b) => b.clusterKey)
    );
    await tx.community.update({ where: { id: merged.id }, data: mergedStats });
  });

  return Response.json({ ok: true, communityId: merged?.id ?? null });
}
