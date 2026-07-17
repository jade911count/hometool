// 社區重建端點（匯入資料後由 n8n 接續呼叫）
// POST /api/admin/communities → 重建 Community 表，兩種來源：
//   presale：預售交易的建案名稱（排除解約），（建案名稱＋行政區）為一社區
//   address：中古集合住宅的門牌歸戶，一個正規化地址為一社區（名稱暫以門牌代稱）

import { prisma } from "@/lib/prisma";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";
import { addressAlias, CONDO_TYPE_RE } from "@/lib/community";
import { SQM_PER_PING } from "@/lib/types";

interface TxRow {
  district: string;
  address: string;
  transactionDate: Date;
  unitPrice: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface Agg {
  name: string;
  district: string;
  source: string;
  clusterKey: string | null;
  addresses: Map<string, number>;
  latSum: number;
  lngSum: number;
  geoCount: number;
  unitPriceSum: number;
  unitPriceCount: number;
  txCount: number;
  lastDealDate: Date | null;
}

function newAgg(
  name: string,
  district: string,
  source: string,
  clusterKey: string | null
): Agg {
  return {
    name,
    district,
    source,
    clusterKey,
    addresses: new Map(),
    latSum: 0,
    lngSum: 0,
    geoCount: 0,
    unitPriceSum: 0,
    unitPriceCount: 0,
    txCount: 0,
    lastDealDate: null,
  };
}

/** 合併兩個聚合（同名冊多門牌 → 單一社區條目） */
function mergeAgg(target: Agg, src: Agg) {
  target.txCount += src.txCount;
  for (const [addr, n] of src.addresses) {
    target.addresses.set(addr, (target.addresses.get(addr) ?? 0) + n);
  }
  target.latSum += src.latSum;
  target.lngSum += src.lngSum;
  target.geoCount += src.geoCount;
  target.unitPriceSum += src.unitPriceSum;
  target.unitPriceCount += src.unitPriceCount;
  if (
    src.lastDealDate &&
    (!target.lastDealDate || src.lastDealDate > target.lastDealDate)
  ) {
    target.lastDealDate = src.lastDealDate;
  }
}

function accumulate(g: Agg, r: TxRow) {
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

/** 分頁掃描交易（全表載入在歷史回補後會撞記憶體），逐筆交給 onRow 聚合 */
async function forEachTransaction(
  where: Record<string, unknown>,
  onRow: (r: TxRow & { projectName: string | null; normalizedAddress: string | null; buildingType: string | null }) => void
): Promise<number> {
  const PAGE = 20000;
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const page = await prisma.transaction.findMany({
      where,
      select: {
        serialNo: true,
        projectName: true,
        normalizedAddress: true,
        buildingType: true,
        district: true,
        address: true,
        transactionDate: true,
        unitPrice: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { serialNo: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { serialNo: cursor }, skip: 1 } : {}),
    });
    for (const r of page) onRow(r);
    count += page.length;
    if (page.length < PAGE) return count;
    cursor = page[page.length - 1].serialNo;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const groups = new Map<string, Agg>();

  // 來源一：預售建案
  const presaleCount = await forEachTransaction(
    { category: "presale", projectName: { not: null }, cancellation: null },
    (r) => {
      const key = `p|${r.district}|${r.projectName}`;
      let g = groups.get(key);
      if (!g) {
        g = newAgg(r.projectName!, r.district, "presale", null);
        groups.set(key, g);
      }
      accumulate(g, r);
    }
  );

  // 來源二：中古集合住宅門牌歸戶
  await forEachTransaction(
    {
      category: "sale",
      normalizedAddress: { not: null },
      buildingType: { not: null }, // 集合住宅細分於下方以 regex 過濾
    },
    (r) => {
      if (!r.buildingType || !CONDO_TYPE_RE.test(r.buildingType)) return;
      const key = `a|${r.normalizedAddress}`;
      let g = groups.get(key);
      if (!g) {
        g = newAgg(
          addressAlias(r.normalizedAddress!, r.district),
          r.district,
          "address",
          r.normalizedAddress
        );
        groups.set(key, g);
      }
      accumulate(g, r);
    }
  );

  // 一名冊多門牌：已綁定的門牌聚合合併為單一社區條目，名稱／戶數取自名冊
  const bindings = await prisma.communityBinding.findMany({
    select: {
      clusterKey: true,
      registry: {
        select: { id: true, name: true, district: true, households: true },
      },
    },
  });
  const bindingByKey = new Map(bindings.map((b) => [b.clusterKey, b.registry]));

  const standalone: Agg[] = [];
  const mergedByRegistry = new Map<
    string,
    { agg: Agg; households: number | null }
  >();
  for (const g of groups.values()) {
    const reg = g.clusterKey ? bindingByKey.get(g.clusterKey) : undefined;
    if (!reg) {
      standalone.push(g);
      continue;
    }
    let m = mergedByRegistry.get(reg.id);
    if (!m) {
      m = { agg: newAgg(reg.name, reg.district, "address", null), households: reg.households };
      mergedByRegistry.set(reg.id, m);
    }
    mergeAgg(m.agg, g);
  }

  const rowOf = (g: Agg) => ({
    name: g.name,
    district: g.district,
    source: g.source,
    clusterKey: g.clusterKey,
    address:
      [...g.addresses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    latitude: g.geoCount ? g.latSum / g.geoCount : null,
    longitude: g.geoCount ? g.lngSum / g.geoCount : null,
    txCount: g.txCount,
    avgUnitPricePerPing: g.unitPriceCount
      ? Math.round((g.unitPriceSum / g.unitPriceCount) * SQM_PER_PING)
      : null,
    lastDealDate: g.lastDealDate,
  });

  const data = [
    ...standalone.map((g) => ({
      ...rowOf(g),
      registryId: null as string | null,
      registryHouseholds: null as number | null,
    })),
    ...[...mergedByRegistry.entries()].map(([registryId, m]) => ({
      ...rowOf(m.agg),
      registryId,
      registryHouseholds: m.households,
    })),
  ];

  // 預售社區補建商／戶數：建案備查依（建案名稱＋行政區）對應
  const buildCases = await prisma.buildCase.findMany({
    select: { name: true, district: true, builder: true, households: true },
  });
  const caseMap = new Map(
    buildCases.map((c) => [`${c.district}|${c.name}`, c])
  );

  // 重建前保留人工補上的欄位（戶數／建商），依（名稱＋區）還原
  const enriched = await prisma.community.findMany({
    where: { OR: [{ households: { not: null } }, { builder: { not: null } }] },
    select: { name: true, district: true, households: true, builder: true },
  });
  const enrichedMap = new Map(
    enriched.map((e) => [`${e.district}|${e.name}`, e])
  );

  const rows = data.map(({ registryHouseholds, ...d }) => {
    const prev = enrichedMap.get(`${d.district}|${d.name}`);
    const bc =
      d.source === "presale" ? caseMap.get(`${d.district}|${d.name}`) : undefined;
    return {
      ...d,
      households: registryHouseholds ?? bc?.households ?? prev?.households ?? null,
      builder: bc?.builder ?? prev?.builder ?? null,
    };
  });

  // 分批寫入：單一句 createMany 在社區數放大後會超過資料庫參數上限
  // （與匯入端點同 pattern：先清後寫、失敗重跑即復原）
  const CHUNK_SIZE = 1000;
  await prisma.community.deleteMany({});
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await prisma.community.createMany({
      data: rows.slice(i, i + CHUNK_SIZE),
      skipDuplicates: true,
    });
  }

  return Response.json({
    communities: data.length,
    presaleCommunities: data.filter((d) => d.source === "presale").length,
    addressCommunities: data.filter((d) => d.source === "address").length,
    presaleTransactions: presaleCount,
  });
}
