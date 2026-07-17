// 社區詳情統計：即時聚合
//   source=presale → 該建案的預售交易（排除解約）
//   source=address → 該門牌的中古交易
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
  source: string; // presale / address
  buildingType: string | null; // 最常見建物型態（address 型社區顯示用）
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
  /** 已綁定的官方名冊（address 型社區）；addresses = 該名冊所有已綁門牌 */
  registry: {
    id: string;
    name: string;
    addresses: { clusterKey: string; alias: string }[];
  } | null;
}

/** 門牌代稱：去掉「臺中市＋行政區」前綴（臺中市北屯區詔安街88號 → 詔安街88號） */
export function addressAlias(normalizedAddress: string, district: string): string {
  return normalizedAddress.replace("臺中市", "").replace(district, "");
}

/** 歸戶對象：有社區概念的集合住宅（透天、店面、廠辦排除） */
export const CONDO_TYPE_RE = /住宅大樓|華廈|公寓|套房/;

/** 依 rebuild 同一套規則計算一組門牌的社區統計（bind／unbind 即時改寫社區列用） */
export async function computeAddressCommunityStats(clusterKeys: string[]) {
  const txs = await prisma.transaction.findMany({
    where: {
      category: "sale",
      normalizedAddress: { in: clusterKeys },
      buildingType: { not: null },
    },
    select: {
      buildingType: true,
      address: true,
      transactionDate: true,
      unitPrice: true,
      latitude: true,
      longitude: true,
    },
  });

  const addresses = new Map<string, number>();
  let latSum = 0;
  let lngSum = 0;
  let geoCount = 0;
  let unitPriceSum = 0;
  let unitPriceCount = 0;
  let txCount = 0;
  let lastDealDate: Date | null = null;
  for (const r of txs) {
    if (!r.buildingType || !CONDO_TYPE_RE.test(r.buildingType)) continue;
    txCount++;
    if (r.address) addresses.set(r.address, (addresses.get(r.address) ?? 0) + 1);
    if (r.latitude !== null && r.longitude !== null) {
      latSum += r.latitude;
      lngSum += r.longitude;
      geoCount++;
    }
    if (r.unitPrice !== null) {
      unitPriceSum += r.unitPrice;
      unitPriceCount++;
    }
    if (!lastDealDate || r.transactionDate > lastDealDate) {
      lastDealDate = r.transactionDate;
    }
  }

  return {
    address:
      [...addresses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    latitude: geoCount ? latSum / geoCount : null,
    longitude: geoCount ? lngSum / geoCount : null,
    txCount,
    avgUnitPricePerPing: unitPriceCount
      ? Math.round((unitPriceSum / unitPriceCount) * SQM_PER_PING)
      : null,
    lastDealDate,
  };
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

  // address 型社區的交易門牌：已綁名冊 → 名冊所有門牌；未綁 → 自身分群鍵
  let registry: CommunityDetail["registry"] = null;
  let clusterKeys: string[] = [];
  if (community.source === "address") {
    if (community.registryId) {
      const reg = await prisma.condoRegistry.findUnique({
        where: { id: community.registryId },
        select: {
          id: true,
          name: true,
          bindings: { select: { clusterKey: true }, orderBy: { boundAt: "asc" } },
        },
      });
      if (reg) {
        clusterKeys = reg.bindings.map((b) => b.clusterKey);
        registry = {
          id: reg.id,
          name: reg.name,
          addresses: clusterKeys.map((k) => ({
            clusterKey: k,
            alias: addressAlias(k, community.district),
          })),
        };
      }
    } else if (community.clusterKey) {
      clusterKeys = [community.clusterKey];
    }
  }

  const where =
    community.source === "address"
      ? { category: "sale", normalizedAddress: { in: clusterKeys } }
      : {
          category: "presale",
          projectName: community.name,
          district: community.district,
          cancellation: null as null,
        };

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    select: {
      serialNo: true,
      transactionDate: true,
      buildingUnit: true,
      buildingType: true,
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

  // 最常見建物型態（address 型社區顯示用）
  const typeCount = new Map<string, number>();
  for (const t of txs) {
    if (t.buildingType)
      typeCount.set(t.buildingType, (typeCount.get(t.buildingType) ?? 0) + 1);
  }
  const buildingType =
    [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    id: community.id,
    name: community.name,
    district: community.district,
    source: community.source,
    buildingType,
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
    registry,
  };
}
