// 地圖社區圖層：回傳視窗範圍內有座標的社區（供地圖建築物圖示用）
// GET /api/communities/map?bbox=minLng,minLat,maxLng,maxLat&limit=150

import { prisma } from "@/lib/prisma";
import type { CommunityMapHit } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get("bbox");
  if (!bbox) return Response.json({ error: "bbox required" }, { status: 400 });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
  if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
    return Response.json({ error: "invalid bbox" }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get("limit")) || 150, 300);

  const rows = await prisma.community.findMany({
    where: {
      latitude: { gte: minLat, lte: maxLat },
      longitude: { gte: minLng, lte: maxLng },
    },
    orderBy: { txCount: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      district: true,
      source: true,
      txCount: true,
      avgUnitPricePerPing: true,
      households: true,
      latitude: true,
      longitude: true,
    },
  });

  return Response.json({ communities: rows satisfies CommunityMapHit[] });
}
