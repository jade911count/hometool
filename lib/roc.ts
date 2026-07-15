// 民國日期字串處理。實價登錄的日期格式為民國年，如 "1141201"（114年12月1日）、
// 建築完成年月可能為 "0870613"、空字串或不完整值。

/** 民國 7 碼日期字串轉 Date，無法解析時回傳 null */
export function parseRocDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\d{6,7}$/.test(s)) return null;
  const day = Number(s.slice(-2));
  const month = Number(s.slice(-4, -2));
  const rocYear = Number(s.slice(0, -4));
  if (rocYear < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(rocYear + 1911, month - 1, day));
  return isNaN(d.getTime()) ? null : d;
}

/** 西元 Date 所屬的實價登錄資料季別，如 2025-12-01 → "114S4" */
export function seasonOf(date: Date): string {
  const rocYear = date.getUTCFullYear() - 1911;
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${rocYear}S${quarter}`;
}

/** 從指定日期往回列出 n 個季別（含當季），新到舊 */
export function recentSeasons(n: number, from: Date = new Date()): string[] {
  const seasons: string[] = [];
  let rocYear = from.getUTCFullYear() - 1911;
  let quarter = Math.floor(from.getUTCMonth() / 3) + 1;
  for (let i = 0; i < n; i++) {
    seasons.push(`${rocYear}S${quarter}`);
    quarter--;
    if (quarter === 0) {
      quarter = 4;
      rocYear--;
    }
  }
  return seasons;
}
