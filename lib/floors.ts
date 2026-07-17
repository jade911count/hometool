// 樓層工具（純函式，前後端共用）：
// 內政部實價登錄的樓層欄位用中文數字（「九層」「地下一層」「九層，十層」…）

const CN_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 中文樓層數轉數字：「七層」→ 7、「二十一層」→ 21。無法解析回傳 null */
export function parseChineseFloors(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.replace(/層|\s/g, "");
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^([一二三四五六七八九]?)(十?)([一二三四五六七八九]?)$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const tens = m[2] ? (m[1] ? CN_DIGITS[m[1]] : 1) * 10 : CN_DIGITS[m[1]] ?? 0;
  const ones = m[2] ? (m[3] ? CN_DIGITS[m[3]] : 0) : 0;
  return tens + ones || null;
}

/**
 * 移轉層次的顯示格式：「九層」→ 9F、「地下一層」→ B1、「九層，十層」→ 9F,10F。
 * 無法解析的部分（「全」「見其他登記事項」…）原樣保留
 */
export function floorLabel(raw: string): string {
  return raw
    .split(/[，,、]/)
    .map((part) => {
      const p = part.trim();
      const m = p.match(/^(地下)?(.+層)$/);
      const n = m ? parseChineseFloors(m[2]) : null;
      if (n === null) return p;
      return m![1] ? `B${n}` : `${n}F`;
    })
    .join(",");
}
