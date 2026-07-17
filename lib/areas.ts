// 台中重劃區／生活圈辭典（搜尋「七期」等俗稱時回傳附近社區用）
// 邊界以「中心點＋半徑」圓形近似，非精確重劃線；條目可隨時增修。
// 中心點取自明確地標（市政府、公園、學校），半徑抓生活圈慣用範圍。

export interface AreaEntry {
  name: string; // 顯示名稱
  aliases: string[]; // 搜尋別名（完全比對）
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export const TAICHUNG_AREAS: AreaEntry[] = [
  {
    name: "七期重劃區（市政特區）",
    aliases: ["七期", "7期", "市政特區", "七期重劃區"],
    latitude: 24.1617,
    longitude: 120.6469, // 台中市政府
    radiusKm: 1.6,
  },
  {
    name: "八期重劃區",
    aliases: ["八期", "8期", "八期重劃區", "豐樂公園"],
    latitude: 24.1266,
    longitude: 120.6524, // 豐樂雕塑公園
    radiusKm: 1.3,
  },
  {
    name: "十四期重劃區",
    aliases: ["十四期", "14期", "十四期重劃區"],
    latitude: 24.1780,
    longitude: 120.6930, // 洲際棒球場南側
    radiusKm: 1.8,
  },
  {
    name: "水湳經貿園區",
    aliases: ["水湳", "水湳經貿園區", "中央公園"],
    latitude: 24.1745,
    longitude: 120.6592, // 台中中央公園
    radiusKm: 1.6,
  },
  {
    name: "單元二重劃區",
    aliases: ["單元二", "單元2"],
    latitude: 24.1320,
    longitude: 120.6300, // 南屯龍富路一帶
    radiusKm: 1.3,
  },
  {
    name: "美術館特區",
    aliases: ["美術館", "美術館特區", "國美館"],
    latitude: 24.1394,
    longitude: 120.6626, // 國立台灣美術館
    radiusKm: 1.0,
  },
  {
    name: "草悟道",
    aliases: ["草悟道", "勤美"],
    latitude: 24.1500,
    longitude: 120.6640, // 勤美誠品一帶
    radiusKm: 0.9,
  },
  {
    name: "逢甲商圈",
    aliases: ["逢甲", "逢甲商圈"],
    latitude: 24.1793,
    longitude: 120.6466, // 逢甲大學
    radiusKm: 1.1,
  },
  {
    name: "高鐵特區",
    aliases: ["高鐵特區", "烏日高鐵", "高鐵"],
    latitude: 24.1121,
    longitude: 120.6157, // 高鐵台中站
    radiusKm: 1.6,
  },
  {
    name: "東海商圈",
    aliases: ["東海", "東海商圈"],
    latitude: 24.1817,
    longitude: 120.6014, // 東海大學
    radiusKm: 1.2,
  },
];

/** 完全比對別名或名稱，命中回傳條目 */
export function matchArea(q: string): AreaEntry | null {
  const s = q.trim();
  return (
    TAICHUNG_AREAS.find(
      (a) => a.name === s || a.aliases.includes(s)
    ) ?? null
  );
}

/** 兩點距離（公里，haversine） */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
