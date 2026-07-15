// 地圖查詢端點：回傳範圍內已定位的成交點
// GET /api/transactions?bbox=minLng,minLat,maxLng,maxLat
//   &district=西屯區&buildingType=住宅大樓&priceMin=500&priceMax=2000（單位：萬元）
//   &dateFrom=2024-01-01&dateTo=2026-07-01&limit=1500

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const where: Prisma.TransactionWhereInput = {
    latitude: { not: null },
    longitude: { not: null },
  };

  const bbox = searchParams.get("bbox");
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
      return Response.json({ error: "invalid bbox" }, { status: 400 });
    }
    where.latitude = { gte: minLat, lte: maxLat };
    where.longitude = { gte: minLng, lte: maxLng };
  }

  const district = searchParams.get("district");
  if (district) where.district = district;

  const buildingType = searchParams.get("buildingType");
  if (buildingType) where.buildingType = { contains: buildingType };

  // 價格參數單位為萬元
  const priceMin = Number(searchParams.get("priceMin"));
  const priceMax = Number(searchParams.get("priceMax"));
  if (priceMin > 0 || priceMax > 0) {
    where.totalPrice = {
      ...(priceMin > 0 ? { gte: BigInt(Math.round(priceMin * 10000)) } : {}),
      ...(priceMax > 0 ? { lte: BigInt(Math.round(priceMax * 10000)) } : {}),
    };
  }

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (dateFrom || dateTo) {
    where.transactionDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const limit = Math.min(Number(searchParams.get("limit")) || 1500, 3000);

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    take: limit,
    select: {
      serialNo: true,
      district: true,
      address: true,
      normalizedAddress: true,
      latitude: true,
      longitude: true,
      transactionDate: true,
      buildingType: true,
      buildingArea: true,
      floor: true,
      totalFloors: true,
      rooms: true,
      halls: true,
      baths: true,
      totalPrice: true,
      unitPrice: true,
      completionDate: true,
      geoPrecision: true,
    },
  });

  const points = rows.map((r) => ({
    ...r,
    totalPrice: Number(r.totalPrice),
    // 單價換算為每坪（1 坪 = 3.3058 m²）
    unitPricePerPing: r.unitPrice ? Math.round(r.unitPrice * 3.3058) : null,
    areaPing: r.buildingArea ? Math.round(r.buildingArea * 0.3025 * 100) / 100 : null,
  }));

  return Response.json({ count: points.length, points });
}
