// 社區重建端點（匯入預售資料後由 n8n 接續呼叫）
// POST /api/admin/communities → 從預售交易的建案名稱重建 Community 表
// 排除已解約案件；同名建案以（建案名稱＋行政區）視為同一社區

import { prisma } from "@/lib/prisma";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";
import { SQM_PER_PING } from "@/lib/types";

interface Agg {
  name: string;
  district: string;
  addresses: Map<string, number>;
  latSum: number;
  lngSum: number;
  geoCount: number;
  unitPriceSum: number;
  unitPriceCount: number;
  txCount: number;
  lastDealDate: Date | null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const rows = await prisma.transaction.findMany({
    where: { category: "presale", projectName: { not: null }, cancellation: null },
    select: {
      projectName: true,
      district: true,
      address: true,
      transactionDate: true,
      unitPrice: true,
      latitude: true,
      longitude: true,
    },
  });

  const groups = new Map<string, Agg>();
  for (const r of rows) {
    const key = `${r.district}|${r.projectName}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        name: r.projectName!,
        district: r.district,
        addresses: new Map(),
        latSum: 0,
        lngSum: 0,
        geoCount: 0,
        unitPriceSum: 0,
        unitPriceCount: 0,
        txCount: 0,
        lastDealDate: null,
      };
      groups.set(key, g);
    }
    g.txCount++;
    if (r.address) g.addresses.set(r.address, (g.addresses.get(r.address) ?? 0) + 1);
    if (r.latitude !== null && r.longitude !== null) {
      g.latSum += r.latitude;
      g.lngSum += r.longitude;
      g.geoCount++;
    }
    if (r.unitPrice !== null) {
      g.unitPriceSum += r.unitPrice;
      g.unitPriceCount++;
    }
    if (!g.lastDealDate || r.transactionDate > g.lastDealDate) {
      g.lastDealDate = r.transactionDate;
    }
  }

  const data = [...groups.values()].map((g) => ({
    name: g.name,
    district: g.district,
    address:
      [...g.addresses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    latitude: g.geoCount ? g.latSum / g.geoCount : null,
    longitude: g.geoCount ? g.lngSum / g.geoCount : null,
    txCount: g.txCount,
    avgUnitPricePerPing: g.unitPriceCount
      ? Math.round((g.unitPriceSum / g.unitPriceCount) * SQM_PER_PING)
      : null,
    lastDealDate: g.lastDealDate,
  }));

  // 重建前保留使照階段補上的欄位（戶數／建商），依（名稱＋區）還原
  const enriched = await prisma.community.findMany({
    where: { OR: [{ households: { not: null } }, { builder: { not: null } }] },
    select: { name: true, district: true, households: true, builder: true },
  });
  const enrichedMap = new Map(
    enriched.map((e) => [`${e.district}|${e.name}`, e])
  );

  await prisma.$transaction([
    prisma.community.deleteMany({}),
    prisma.community.createMany({
      data: data.map((d) => {
        const prev = enrichedMap.get(`${d.district}|${d.name}`);
        return {
          ...d,
          households: prev?.households ?? null,
          builder: prev?.builder ?? null,
        };
      }),
    }),
  ]);

  return Response.json({
    communities: data.length,
    presaleTransactions: rows.length,
  });
}
