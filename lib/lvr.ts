// 內政部實價登錄開放資料：下載與解析
// 資料來源：https://plvr.land.moi.gov.tw（每月 1、11、21 日更新批次）
// 臺中市縣市代碼 = B；買賣案件檔 = B_lvr_land_A.csv、預售屋檔 = B_lvr_land_B.csv（UTF-8 with BOM）
// 預售屋檔比買賣檔多三欄：建案名稱、棟及號、解約情形；少了主/附建物、陽台面積與電梯欄

import { parse } from "csv-parse/sync";
import { parseRocDate } from "./roc";
import { parseChineseFloors } from "./floors";

const DOWNLOAD_URL = "https://plvr.land.moi.gov.tw/DownloadSeason";

/** 檔別 → Transaction.category 的對應：A 檔=中古買賣、B 檔=預售屋 */
export type LvrCategory = "sale" | "presale";
export const FILE_OF_CATEGORY: Record<LvrCategory, string> = {
  sale: "A",
  presale: "B",
};

export interface LvrRecord {
  serialNo: string;
  category: LvrCategory;
  projectName: string | null;
  buildingUnit: string | null;
  cancellation: string | null;
  district: string;
  transactionType: string;
  address: string;
  normalizedAddress: string | null;
  landArea: number | null;
  zoning: string | null;
  transactionDate: Date;
  transactionItems: string | null;
  floor: string | null;
  totalFloors: number | null;
  buildingType: string | null;
  mainUse: string | null;
  buildingMaterial: string | null;
  completionDate: Date | null;
  buildingArea: number | null;
  rooms: number | null;
  halls: number | null;
  baths: number | null;
  compartmented: boolean | null;
  hasManagement: boolean | null;
  totalPrice: bigint;
  unitPrice: number | null;
  parkingType: string | null;
  parkingArea: number | null;
  parkingPrice: bigint | null;
  note: string | null;
  mainBuildingArea: number | null;
  auxBuildingArea: number | null;
  balconyArea: number | null;
  hasElevator: boolean | null;
  season: string;
}

/** 下載指定季別的臺中市買賣 CSV，季別如 "114S4"。檔案不存在時回傳 null */
export async function downloadSeasonCsv(
  season: string,
  city = "B",
  category = "A"
): Promise<string | null> {
  const url = `${DOWNLOAD_URL}?season=${season}&fileName=${city}_lvr_land_${category}.csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return null;
  const text = await res.text();
  // 季別不存在時伺服器仍回 200，但內容是 HTML 錯誤頁或空檔
  if (!text.includes("鄉鎮市區")) return null;
  return text;
}

const FULL_WIDTH_DIGITS = "０１２３４５６７８９";

/** 全形數字轉半形 */
export function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String(FULL_WIDTH_DIGITS.indexOf(c)).toString());
}

/**
 * 地址正規化供地理編碼使用：
 * - 全形數字轉半形
 * - 去掉「號」之後的樓層資訊（…１５６號５樓之２ → …156號）
 * - 土地案件（無門牌、只有地號）回傳 null
 */
export function normalizeAddress(address: string): string | null {
  if (!address) return null;
  let a = toHalfWidth(address.replace(/\s+/g, ""));
  if (a.includes("地號") || !a.includes("號")) return null;
  a = a.replace(/號.*$/, "號");
  return a.length >= 8 ? a : null;
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function big(v: string | undefined): bigint | null {
  if (v === undefined) return null;
  const s = v.trim().replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  return BigInt(s);
}

function yesNo(v: string | undefined): boolean | null {
  if (v === "有") return true;
  if (v === "無") return false;
  return null;
}

function str(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/** 解析實價登錄 CSV 內容為結構化紀錄（跳過英文標頭列與無效列） */
export function parseLvrCsv(
  csvText: string,
  season: string,
  category: LvrCategory = "sale"
): LvrRecord[] {
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  });

  const records: LvrRecord[] = [];
  for (const row of rows) {
    // 第二列是英文標頭，鄉鎮市區欄位值會是英文說明文字
    const district = row["鄉鎮市區"]?.trim();
    if (!district || /[a-zA-Z]/.test(district)) continue;

    const serialNo = row["編號"]?.trim();
    const transactionDate = parseRocDate(row["交易年月日"]);
    const totalPrice = big(row["總價元"]);
    if (!serialNo || !transactionDate || totalPrice === null) continue;

    const address = row["土地位置建物門牌"]?.trim() ?? "";
    records.push({
      serialNo,
      category,
      projectName: str(row["建案名稱"]),
      buildingUnit: str(row["棟及號"]),
      cancellation: str(row["解約情形"]),
      district,
      transactionType: row["交易標的"]?.trim() ?? "",
      address,
      normalizedAddress: normalizeAddress(address),
      landArea: num(row["土地移轉總面積平方公尺"]),
      zoning: str(row["都市土地使用分區"]),
      transactionDate,
      transactionItems: str(row["交易筆棟數"]),
      floor: str(row["移轉層次"]),
      totalFloors: parseChineseFloors(row["總樓層數"]),
      buildingType: str(row["建物型態"]),
      mainUse: str(row["主要用途"]),
      buildingMaterial: str(row["主要建材"]),
      completionDate: parseRocDate(row["建築完成年月"]),
      buildingArea: num(row["建物移轉總面積平方公尺"]),
      rooms: num(row["建物現況格局-房"]),
      halls: num(row["建物現況格局-廳"]),
      baths: num(row["建物現況格局-衛"]),
      compartmented: yesNo(row["建物現況格局-隔間"]),
      hasManagement: yesNo(row["有無管理組織"]),
      totalPrice,
      unitPrice: num(row["單價元平方公尺"]),
      parkingType: str(row["車位類別"]),
      parkingArea: num(row["車位移轉總面積平方公尺"]),
      parkingPrice: big(row["車位總價元"] ?? ""),
      note: str(row["備註"]),
      mainBuildingArea: num(row["主建物面積"]),
      auxBuildingArea: num(row["附屬建物面積"]),
      balconyArea: num(row["陽台面積"]),
      hasElevator: yesNo(row["電梯"]),
      season,
    });
  }
  return records;
}
