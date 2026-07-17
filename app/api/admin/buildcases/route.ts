// 預售屋建案備查匯入端點（掛在 n8n 匯入 workflow：匯入實價登錄 → 本端點 → 重建社區）
// POST /api/admin/buildcases → 下載臺中建案備查 CSV，整表重建 BuildCase
// rebuild 會用（建案名稱＋行政區）把建商／戶數補進預售社區

import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";
import { parseRocDate } from "@/lib/roc";

// 內政部 plvr「預售備查建案」單檔下載（臺中市 = B；與成交案件同系統、同批次更新）
const BUILDCASE_CSV_URL =
  "https://plvr.land.moi.gov.tw/Download?type=csv&PayType=saleremark&fileName=b_lvr_buildcase.csv";

const CHUNK_SIZE = 1000;

interface CaseRow {
  name: string;
  district: string;
  builder: string;
  households: number | null;
  street: string | null;
  sellingPeriod: string | null;
  permitNo: string | null;
  declareDate: Date | null;
}

/** 起造人清理：「聚佳建設股份有限公司負責人：林建甫」→「聚佳建設股份有限公司」 */
function cleanBuilder(raw: string): string {
  return raw.replace(/負責人[:：].*$/, "").trim();
}

function str(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/** 解析建案備查 CSV（第二列為英文標頭；同名同區取備查日期最新一筆） */
function parseBuildCaseCsv(csvText: string): { rows: CaseRow[]; skipped: number } {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  });

  const byKey = new Map<string, CaseRow>();
  let skipped = 0;
  for (const r of records) {
    const district = r["鄉鎮市區"]?.trim();
    const name = r["建案名稱"]?.trim();
    const builder = cleanBuilder(r["起造人"] ?? "");
    // 第二列是英文標頭（鄉鎮市區欄位值為 TOWN）
    if (!district || /[a-zA-Z]/.test(district) || !name || !builder) {
      skipped++;
      continue;
    }
    const households = Number(r["層棟戶數"]);
    const row: CaseRow = {
      name,
      district,
      builder,
      households:
        Number.isInteger(households) && households > 0 ? households : null,
      street: str(r["坐落街道"]),
      sellingPeriod: str(r["銷售期間"]),
      permitNo: str(r["建造執照"]),
      declareDate: parseRocDate(r["申報備查日期"]),
    };
    const key = `${row.district}|${row.name}`;
    const prev = byKey.get(key);
    if (
      prev &&
      (prev.declareDate?.getTime() ?? 0) >= (row.declareDate?.getTime() ?? 0)
    ) {
      skipped++;
      continue;
    }
    if (prev) skipped++;
    byKey.set(key, row);
  }
  return { rows: [...byKey.values()], skipped };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const res = await fetch(BUILDCASE_CSV_URL);
  if (!res.ok) {
    return Response.json(
      { error: `buildcase download failed: HTTP ${res.status}` },
      { status: 502 }
    );
  }
  const { rows, skipped } = parseBuildCaseCsv(await res.text());
  if (rows.length === 0) {
    return Response.json({ error: "buildcase csv parsed to 0 rows" }, { status: 502 });
  }

  await prisma.buildCase.deleteMany({});
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await prisma.buildCase.createMany({
      data: rows.slice(i, i + CHUNK_SIZE),
      skipDuplicates: true,
    });
  }

  return Response.json({ imported: rows.length, skipped });
}
