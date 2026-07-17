// 社區搜尋端點（autocomplete）
// GET /api/communities?q=惠宇        → 名稱包含關鍵字，依成交筆數排序；
//                                      另附上名稱符合、尚未綁定門牌的官方名冊社區
// GET /api/communities               → 熱門社區（成交筆數最多）

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

  // 官方名冊（公寓大廈報備）中名稱符合、尚未綁定門牌的社區：
  // 搜得到但還沒有交易資料入口，提示使用者到中古社區頁綁定
  const registry: RegistryHit[] = q
    ? await prisma.condoRegistry.findMany({
        where: { name: { contains: q }, boundClusterKey: null },
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
