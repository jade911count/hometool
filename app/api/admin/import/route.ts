// 實價登錄匯入端點（由 n8n 排程呼叫）
// POST /api/admin/import                  → 匯入近兩年（8 季）
// POST /api/admin/import?seasons=114S4    → 匯入指定季別（逗號分隔）
// 同一季重複匯入時會先清除該季舊資料再寫入（內政部每月 1/11/21 日會更新批次）

import { prisma } from "@/lib/prisma";
import { downloadSeasonCsv, parseLvrCsv } from "@/lib/lvr";
import { recentSeasons } from "@/lib/roc";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";

const CHUNK_SIZE = 1000;

interface SeasonResult {
  season: string;
  status: "imported" | "not-available" | "error";
  count?: number;
  error?: string;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const seasonsParam = searchParams.get("seasons");
  const seasons = seasonsParam
    ? seasonsParam.split(",").map((s) => s.trim())
    : recentSeasons(8);

  const results: SeasonResult[] = [];
  for (const season of seasons) {
    if (!/^\d{3}S[1-4]$/.test(season)) {
      results.push({ season, status: "error", error: "invalid season format" });
      continue;
    }
    try {
      const csv = await downloadSeasonCsv(season);
      if (!csv) {
        results.push({ season, status: "not-available" });
        continue;
      }
      const records = parseLvrCsv(csv, season);

      await prisma.transaction.deleteMany({ where: { season } });
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        await prisma.transaction.createMany({
          data: records.slice(i, i + CHUNK_SIZE),
          skipDuplicates: true,
        });
      }
      results.push({ season, status: "imported", count: records.length });
    } catch (e) {
      results.push({
        season,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const total = await prisma.transaction.count();
  return Response.json({ results, totalInDb: total });
}
