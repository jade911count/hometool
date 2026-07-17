// 名冊綁定端點：把官方名冊（公寓大廈報備）社區綁到中古門牌社區
// POST   /api/communities/bind { registryId, communityId } → 綁定，社區獲得名稱＋戶數
// DELETE /api/communities/bind { registryId }              → 解除綁定，社區名稱還原為門牌代稱
// 未登入階段開放操作：記錄 IP＋時間供回溯，並以 IP 做簡易頻率限制

import { prisma } from "@/lib/prisma";
import { addressAlias } from "@/lib/community";

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
    prisma.condoRegistry.findUnique({ where: { id: registryId } }),
    prisma.community.findUnique({ where: { id: communityId } }),
  ]);
  if (!registry || !community) {
    return Response.json({ error: "名冊或社區不存在" }, { status: 404 });
  }
  if (community.source !== "address" || !community.clusterKey) {
    return Response.json(
      { error: "只有中古門牌社區可以綁定名冊" },
      { status: 400 }
    );
  }
  if (registry.boundClusterKey === community.clusterKey) {
    return Response.json({ ok: true, name: registry.name }); // 已綁定，冪等
  }
  if (registry.boundClusterKey) {
    return Response.json(
      { error: `此名冊已綁定其他門牌，請先解除` },
      { status: 409 }
    );
  }
  const occupied = await prisma.condoRegistry.findUnique({
    where: { boundClusterKey: community.clusterKey },
    select: { name: true },
  });
  if (occupied) {
    return Response.json(
      { error: `此社區已綁定「${occupied.name}」，請先解除` },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.condoRegistry.update({
        where: { id: registry.id },
        data: {
          boundClusterKey: community.clusterKey,
          boundAt: new Date(),
          boundByIp: ip,
        },
      }),
      prisma.community.update({
        where: { id: community.id },
        data: { name: registry.name, households: registry.households },
      }),
    ]);
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

  return Response.json({ ok: true, name: registry.name });
}

export async function DELETE(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return Response.json({ error: "操作過於頻繁，請稍後再試" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const registryId = body?.registryId as string | undefined;
  if (!registryId) {
    return Response.json({ error: "registryId 必填" }, { status: 400 });
  }

  const registry = await prisma.condoRegistry.findUnique({
    where: { id: registryId },
  });
  if (!registry) {
    return Response.json({ error: "名冊不存在" }, { status: 404 });
  }
  if (!registry.boundClusterKey) {
    return Response.json({ ok: true }); // 未綁定，冪等
  }

  const community = await prisma.community.findFirst({
    where: { clusterKey: registry.boundClusterKey, source: "address" },
  });

  await prisma.$transaction([
    prisma.condoRegistry.update({
      where: { id: registry.id },
      data: { boundClusterKey: null, boundAt: null, boundByIp: null },
    }),
    ...(community
      ? [
          prisma.community.update({
            where: { id: community.id },
            data: {
              name: addressAlias(registry.boundClusterKey, community.district),
              households: null,
            },
          }),
        ]
      : []),
  ]);

  return Response.json({ ok: true });
}
