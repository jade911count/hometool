// 社區搜尋端點（autocomplete）
// GET /api/communities?q=惠宇               → 名稱或建商包含關鍵字，依成交筆數排序；
//                                             另附上名稱符合、尚未綁定門牌的官方名冊社區
// GET /api/communities?q=七期               → 命中區域辭典時另回傳 area 與範圍內的 nearby 社區
// GET /api/communities?q=惠宇&registry=all  → 名冊不過濾綁定狀態（綁定元件用：併棟時要選到已綁名冊）
// GET /api/communities                      → 熱門社區（成交筆數最多）

import { prisma } from "@/lib/prisma";
import { matchArea, distanceKm } from "@/lib/areas";
import type { CommunityHit, RegistryHit } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 30);

  // 名稱或建商比對：輸入「興富發」可列出該建商旗下所有建案
  const rows = await prisma.community.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { builder: { contains: q } }] }
      : {},
    orderBy: { txCount: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      district: true,
      source: true,
      txCount: true,
      avgUnitPricePerPing: true,
      builder: true,
    },
  });

  // 官方名冊（公寓大廈報備）中名稱符合的社區：
  // 預設只列尚未綁定門牌的（已綁定者由社區條目代表）；registry=all 不過濾（併棟綁定用）
  const includeBound = searchParams.get("registry") === "all";
  const registry: RegistryHit[] = q
    ? await prisma.condoRegistry.findMany({
        where: {
          name: { contains: q },
          ...(includeBound ? {} : { bindings: { none: {} } }),
        },
        orderBy: { households: { sort: "desc", nulls: "last" } },
        take: limit,
        select: { id: true, name: true, district: true, households: true },
      })
    : [];

  // 區域關鍵字（七期、水湳…）：回傳範圍內有座標的社區
  const area = q ? matchArea(q) : null;
  let nearby: CommunityHit[] = [];
  if (area) {
    const dLat = area.radiusKm / 111;
    const dLng =
      area.radiusKm / (111 * Math.cos((area.latitude * Math.PI) / 180));
    const candidates = await prisma.community.findMany({
      where: {
        latitude: { gte: area.latitude - dLat, lte: area.latitude + dLat },
        longitude: { gte: area.longitude - dLng, lte: area.longitude + dLng },
      },
      orderBy: { txCount: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        district: true,
        source: true,
        txCount: true,
        avgUnitPricePerPing: true,
        builder: true,
        latitude: true,
        longitude: true,
      },
    });
    nearby = candidates
      .filter(
        (c) =>
          distanceKm(area.latitude, area.longitude, c.latitude!, c.longitude!) <=
          area.radiusKm
      )
      .slice(0, 15)
      .map(({ latitude: _lat, longitude: _lng, ...hit }) => hit);
  }

  return Response.json({
    communities: rows satisfies CommunityHit[],
    registry,
    area: area
      ? { name: area.name, latitude: area.latitude, longitude: area.longitude }
      : null,
    nearby,
  });
}
