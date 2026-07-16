// 實價登錄匯入端點（由 n8n 排程呼叫）
// POST /api/admin/import                              → 匯入近兩年（8 季）買賣＋預售
// POST /api/admin/import?seasons=114S4                → 匯入指定季別（逗號分隔）
// POST /api/admin/import?categories=presale           → 只匯入指定檔別（sale,presale）
// 同一季重複匯入時會先清除該季該檔別舊資料再寫入（內政部每月 1/11/21 日會更新批次）

import { prisma } from "@/lib/prisma";
import {
  downloadSeasonCsv,
  parseLvrCsv,
  FILE_OF_CATEGORY,
  type LvrCategory,
} from "@/lib/lvr";
import { recentSeasons } from "@/lib/roc";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";

const CHUNK_SIZE = 1000;
const ALL_CATEGORIES: LvrCategory[] = ["sale", "presale"];

interface SeasonResult {
  season: string;
  category: LvrCategory;
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

  const categoriesParam = searchParams.get("categories");
  const categories = categoriesParam
    ? (categoriesParam.split(",").map((s) => s.trim()) as LvrCategory[])
    : ALL_CATEGORIES;
  if (categories.some((c) => !ALL_CATEGORIES.includes(c))) {
    return Response.json({ error: "invalid categories" }, { status: 400 });
  }

  const results: SeasonResult[] = [];
  for (const season of seasons) {
    if (!/^\d{3}S[1-4]$/.test(season)) {
      results.push({
        season,
        category: categories[0],
        status: "error",
        error: "invalid season format",
      });
      continue;
    }
    for (const category of categories) {
      try {
        const csv = await downloadSeasonCsv(season, "B", FILE_OF_CATEGORY[category]);
        if (!csv) {
          results.push({ season, category, status: "not-available" });
          continue;
        }
        const records = parseLvrCsv(csv, season, category);

        await prisma.transaction.deleteMany({ where: { season, category } });
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          await prisma.transaction.createMany({
            data: records.slice(i, i + CHUNK_SIZE),
            skipDuplicates: true,
          });
        }
        results.push({ season, category, status: "imported", count: records.length });
      } catch (e) {
        results.push({
          season,
          category,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const total = await prisma.transaction.count();
  return Response.json({ results, totalInDb: total });
}
