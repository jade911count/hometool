// 社區搜尋端點（autocomplete）
// GET /api/communities?q=惠宇        → 名稱包含關鍵字，依成交筆數排序
// GET /api/communities               → 熱門社區（成交筆數最多）

import { prisma } from "@/lib/prisma";
import type { CommunityHit } from "@/lib/types";

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
      txCount: true,
      avgUnitPricePerPing: true,
    },
  });

  return Response.json({ communities: rows satisfies CommunityHit[] });
}
