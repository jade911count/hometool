// 官方社區名冊匯入端點（由 n8n 手動觸發；資料約每半年更新一次）
// POST /api/admin/registry → 下載臺中市公寓大廈報備資料 CSV，整表重建 CondoRegistry
// 已綁定門牌的名冊（boundClusterKey 等審計欄位）在重建時依使照序號保留

import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";

// 臺中市公寓大廈報備資料（data.gov.tw #105739，都發局，CSV 免驗證下載）
const REGISTRY_CSV_URL =
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=3ea99d8b-494f-4e16-884e-50f5a82aff36";

const CHUNK_SIZE = 1000;

interface RegistryRow {
  licenseSerial: string;
  name: string;
  orgType: string | null;
  households: number | null;
  district: string;
}

/** 解析報備清冊 CSV：欄位＝使照序號、公寓大廈名稱、管理組織型態、戶數、行政區… */
function parseRegistryCsv(csvText: string): { rows: RegistryRow[]; skipped: number } {
  // 檔案實測帶有重複 BOM、尾端空欄名，且標頭列結尾是 LF、資料列結尾是 CRLF
  // （混用會讓 csv-parse 鎖定錯誤的換行符），先去除 BOM 與 CR 再解析
  const cleaned = csvText.replace(/﻿/g, "").replace(/\r/g, "");
  const options = {
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  } as const;
  let records: Record<string, string>[];
  try {
    records = parse(cleaned, options);
  } catch (e) {
    // 來源檔實測壞尾（最後一筆寫到一半、引號未閉合）：捨棄殘行重試
    if ((e as { code?: string })?.code !== "CSV_QUOTE_NOT_CLOSED") throw e;
    records = parse(cleaned.slice(0, cleaned.lastIndexOf("\n") + 1), options);
  }

  const seen = new Set<string>();
  const rows: RegistryRow[] = [];
  let skipped = 0;
  for (const r of records) {
    const licenseSerial = r["使照序號"]?.trim();
    const name = r["公寓大廈名稱"]?.trim();
    const district = r["行政區"]?.trim();
    // 缺鍵值或（使照序號＋名稱）重複的列跳過（回報筆數供檢核）
    // 使照序號本身會重複：同一張使照可有多個報備組織（如住宅社區＋店面）
    const key = `${licenseSerial}|${name}`;
    if (!licenseSerial || !name || !district || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const households = Number(r["戶數"]);
    rows.push({
      licenseSerial,
      name,
      orgType: r["管理組織型態"]?.trim() || null,
      households: Number.isInteger(households) && households > 0 ? households : null,
      district,
    });
  }
  return { rows, skipped };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const res = await fetch(REGISTRY_CSV_URL);
  if (!res.ok) {
    return Response.json(
      { error: `registry download failed: HTTP ${res.status}` },
      { status: 502 }
    );
  }
  const { rows, skipped } = parseRegistryCsv(await res.text());
  if (rows.length === 0) {
    return Response.json({ error: "registry csv parsed to 0 rows" }, { status: 502 });
  }

  // 重建前保留既有綁定（依使照序號＋名稱還原審計欄位）
  const bound = await prisma.condoRegistry.findMany({
    where: { boundClusterKey: { not: null } },
    select: {
      licenseSerial: true,
      name: true,
      boundClusterKey: true,
      boundAt: true,
      boundByIp: true,
    },
  });
  const boundMap = new Map(bound.map((b) => [`${b.licenseSerial}|${b.name}`, b]));

  await prisma.condoRegistry.deleteMany({});
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await prisma.condoRegistry.createMany({
      data: rows.slice(i, i + CHUNK_SIZE).map((r) => {
        const prev = boundMap.get(`${r.licenseSerial}|${r.name}`);
        return {
          ...r,
          boundClusterKey: prev?.boundClusterKey ?? null,
          boundAt: prev?.boundAt ?? null,
          boundByIp: prev?.boundByIp ?? null,
        };
      }),
      skipDuplicates: true,
    });
  }

  return Response.json({
    imported: rows.length,
    skipped,
    boundPreserved: bound.length,
  });
}
