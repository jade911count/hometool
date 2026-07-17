// 社區搜尋端點（autocomplete）
// GET /api/communities?q=惠宇               → 名稱包含關鍵字，依成交筆數排序；
//                                             另附上名稱符合、尚未綁定門牌的官方名冊社區
// GET /api/communities?q=惠宇&registry=all  → 名冊不過濾綁定狀態（綁定元件用：併棟時要選到已綁名冊）
// GET /api/communities                      → 熱門社區（成交筆數最多）

import { prisma } from "@/lib/prisma";
import type { CommunityHit, RegistryHit } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 30);

  const rows = await prisma.community.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { txCount: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      district: true,
      source: true,
      txCount: true,
      avgUnitPricePerPing: true,
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

  return Response.json({
    communities: rows satisfies CommunityHit[],
    registry,
  });
}
