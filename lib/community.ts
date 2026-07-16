// 社區詳情統計：由預售交易（排除解約）即時聚合
// 供 /community/[id] 頁面（server component）使用

import { prisma } from "./prisma";
import { SQM_PER_PING, PING_PER_SQM } from "./types";

export interface CommunityTrendPoint {
  season: string; // 如 114S1
  count: number;
  avgUnitPricePerPing: number | null; // 元/坪
}

export interface CommunityDeal {
  serialNo: string;
  transactionDate: Date;
  buildingUnit: string | null;
  floor: string | null;
  totalFloors: number | null;
  rooms: number | null;
  halls: number | null;
  baths: number | null;
  totalPrice: number; // 元
  unitPricePerPing: number | null; // 元/坪
  areaPing: number | null;
  parkingType: string | null;
}

export interface CommunityDetail {
  id: string;
  name: string;
  district: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  households: number | null; // 待使照資料
  builder: string | null; // 待使照資料
  completionDate: Date | null; // 建築完成年月（預售案多為 null）
  txCount: number;
  avgTotalPrice: number | null; // 元
  lastDeal: { date: Date; totalPrice: number } | null;
  avgUnitPricePerPing: number | null; // 元/坪
  trend: CommunityTrendPoint[]; // 依季別由舊到新
  deals: CommunityDeal[]; // 由新到舊
}

/** 季別排序鍵："114S3" → 1143 */
function seasonKey(season: string): number {
  const [y, q] = season.split("S");
  return Number(y) * 10 + Number(q);
}

export async function getCommunityDetail(
  id: string
): Promise<CommunityDetail | null> {
  const community = await prisma.community.findUnique({ where: { id } });
  if (!community) return null;

  const txs = await prisma.transaction.findMany({
    where: {
      category: "presale",
      projectName: community.name,
      district: community.district,
      cancellation: null,
    },
    orderBy: { transactionDate: "desc" },
    select: {
      serialNo: true,
      transactionDate: true,
      buildingUnit: true,
      floor: true,
      totalFloors: true,
      rooms: true,
      halls: true,
      baths: true,
      totalPrice: true,
      unitPrice: true,
      buildingArea: true,
      parkingType: true,
      completionDate: true,
      season: true,
    },
  });

  const deals: CommunityDeal[] = txs.map((t) => ({
    serialNo: t.serialNo,
    transactionDate: t.transactionDate,
    buildingUnit: t.buildingUnit,
    floor: t.floor,
    totalFloors: t.totalFloors,
    rooms: t.rooms,
    halls: t.halls,
    baths: t.baths,
    totalPrice: Number(t.totalPrice),
    unitPricePerPing: t.unitPrice
      ? Math.round(t.unitPrice * SQM_PER_PING)
      : null,
    areaPing: t.buildingArea
      ? Math.round(t.buildingArea * PING_PER_SQM * 100) / 100
      : null,
    parkingType: t.parkingType,
  }));

  const priced = deals.filter((d) => d.unitPricePerPing !== null);
  const trendMap = new Map<string, { sum: number; priced: number; count: number }>();
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    const g = trendMap.get(t.season) ?? { sum: 0, priced: 0, count: 0 };
    g.count++;
    const per = deals[i].unitPricePerPing;
    if (per !== null) {
      g.sum += per;
      g.priced++;
    }
    trendMap.set(t.season, g);
  }
  const trend: CommunityTrendPoint[] = [...trendMap.entries()]
    .sort((a, b) => seasonKey(a[0]) - seasonKey(b[0]))
    .map(([season, g]) => ({
      season,
      count: g.count,
      avgUnitPricePerPing: g.priced ? Math.round(g.sum / g.priced) : null,
    }));

  const completionDate =
    txs.map((t) => t.completionDate).find((d) => d !== null) ?? null;

  return {
    id: community.id,
    name: community.name,
    district: community.district,
    address: community.address,
    latitude: community.latitude,
    longitude: community.longitude,
    households: community.households,
    builder: community.builder,
    completionDate,
    txCount: deals.length,
    avgTotalPrice: deals.length
      ? Math.round(deals.reduce((s, d) => s + d.totalPrice, 0) / deals.length)
      : null,
    lastDeal: deals.length
      ? { date: deals[0].transactionDate, totalPrice: deals[0].totalPrice }
      : null,
    avgUnitPricePerPing: priced.length
      ? Math.round(
          priced.reduce((s, d) => s + (d.unitPricePerPing ?? 0), 0) / priced.length
        )
      : null,
    trend,
    deals,
  };
}
