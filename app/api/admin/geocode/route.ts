// 地理編碼端點（由 n8n 排程重複呼叫直到 remaining = 0）
// POST /api/admin/geocode?limit=40
// 使用 Nominatim（OpenStreetMap），遵守 1 request/秒 的使用政策；
// 同一地址只查一次（GeocodeCache），查到後回填所有同地址的成交紀錄。

import { prisma } from "@/lib/prisma";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "hometool/0.1 (Taichung real-estate demo)";
const RATE_LIMIT_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function queryNominatim(
  q: string
): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&countrycodes=tw&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data: { lat: string; lon: string }[] = await res.json();
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

/** 查單一正規化地址：先門牌層級，失敗退到路段層級 */
async function geocode(
  address: string
): Promise<{ lat: number; lng: number; precision: string } | null> {
  const point = await queryNominatim(address);
  if (point) return { ...point, precision: "point" };

  const road = address.replace(/\d+號$/, "");
  if (road !== address && road.length >= 6) {
    await sleep(RATE_LIMIT_MS);
    const roadHit = await queryNominatim(road);
    if (roadHit) return { ...roadHit, precision: "road" };
  }
  return null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 40, 200);

  // 尚未嘗試過地理編碼的地址（geoPrecision 為 null 且有可用的正規化地址）
  const pending = await prisma.transaction.findMany({
    where: { geoPrecision: null, normalizedAddress: { not: null } },
    select: { normalizedAddress: true },
    distinct: ["normalizedAddress"],
    take: limit,
  });

  let ok = 0;
  let failed = 0;
  let fromCache = 0;

  for (const { normalizedAddress } of pending) {
    const addr = normalizedAddress!;
    let cached = await prisma.geocodeCache.findUnique({ where: { query: addr } });

    if (!cached) {
      const hit = await geocode(addr);
      cached = await prisma.geocodeCache.create({
        data: {
          query: addr,
          latitude: hit?.lat ?? null,
          longitude: hit?.lng ?? null,
          precision: hit?.precision ?? "failed",
        },
      });
      await sleep(RATE_LIMIT_MS);
    } else {
      fromCache++;
    }

    await prisma.transaction.updateMany({
      where: { normalizedAddress: addr, geoPrecision: null },
      data: {
        latitude: cached.latitude,
        longitude: cached.longitude,
        geoPrecision: cached.precision,
      },
    });
    if (cached.precision === "failed") failed++;
    else ok++;
  }

  const remaining = await prisma.transaction.count({
    where: { geoPrecision: null, normalizedAddress: { not: null } },
  });

  return Response.json({ processed: pending.length, ok, failed, fromCache, remaining });
}
