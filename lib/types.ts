// 前後端共用的 API 回應型別（日期經 JSON 序列化後為字串）與換算常數

/** 1 坪 = 3.3058 m²：每坪單價 = 每平方公尺單價 × SQM_PER_PING */
export const SQM_PER_PING = 3.3058;
/** 面積換算：坪數 = 平方公尺 × PING_PER_SQM */
export const PING_PER_SQM = 0.3025;

/** 社區搜尋（autocomplete）結果項 */
export interface CommunityHit {
  id: string;
  name: string;
  district: string;
  source: string; // presale=預售建案 / address=中古門牌歸戶
  txCount: number;
  avgUnitPricePerPing: number | null;
}

/** 官方名冊（公寓大廈報備）搜尋結果項：尚未綁定門牌的社區 */
export interface RegistryHit {
  id: string;
  name: string;
  district: string;
  households: number | null;
}

export interface TransactionPoint {
  serialNo: string;
  district: string;
  address: string;
  normalizedAddress: string | null;
  latitude: number;
  longitude: number;
  transactionDate: string;
  buildingType: string | null;
  buildingArea: number | null;
  floor: string | null;
  totalFloors: number | null;
  rooms: number | null;
  halls: number | null;
  baths: number | null;
  totalPrice: number;
  unitPrice: number | null;
  unitPricePerPing: number | null;
  areaPing: number | null;
  completionDate: string | null;
  geoPrecision: string | null;
}

export interface AddressDetail {
  address: string;
  count: number;
  avgUnitPricePerPing: number | null;
  transactions: (TransactionPoint & {
    parkingType: string | null;
    parkingPrice: number | null;
    note: string | null;
    season: string;
  })[];
}

export const TAICHUNG_DISTRICTS = [
  "中區", "東區", "南區", "西區", "北區",
  "北屯區", "西屯區", "南屯區",
  "太平區", "大里區", "霧峰區", "烏日區",
  "豐原區", "后里區", "石岡區", "東勢區", "和平區", "新社區",
  "潭子區", "大雅區", "神岡區",
  "大肚區", "沙鹿區", "龍井區", "梧棲區", "清水區",
  "大甲區", "外埔區", "大安區",
] as const;

export const BUILDING_TYPES = [
  { key: "住宅大樓", label: "住宅大樓" },
  { key: "華廈", label: "華廈" },
  { key: "公寓", label: "公寓" },
  { key: "透天", label: "透天厝" },
  { key: "套房", label: "套房" },
  { key: "店面", label: "店面" },
] as const;
