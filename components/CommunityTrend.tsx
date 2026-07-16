// 社區成交趨勢：上=每坪均價折線、下=成交筆數長條，各自單一量測（不做雙軸）
// Server component：純 SVG，無瀏覽器相依

import type { CommunityTrendPoint } from "@/lib/community";

const BLUE = "#2563eb"; // 已通過 palette 驗證（light surface）
const GRID = "#e2e8f0";
const MUTED = "#64748b";

const W = 640;
const PAD = { left: 56, right: 24, top: 20, bottom: 26 };

function xOf(i: number, n: number): number {
  const inner = W - PAD.left - PAD.right;
  return n === 1 ? PAD.left + inner / 2 : PAD.left + (inner * i) / (n - 1);
}

/** 上緣圓角（4px）、底部貼齊基線的長條 path */
function barPath(cx: number, top: number, bottom: number, width: number): string {
  const r = Math.min(4, width / 2, Math.max(bottom - top, 0));
  const l = cx - width / 2;
  const rgt = cx + width / 2;
  return [
    `M ${l} ${bottom}`,
    `L ${l} ${top + r}`,
    `Q ${l} ${top} ${l + r} ${top}`,
    `L ${rgt - r} ${top}`,
    `Q ${rgt} ${top} ${rgt} ${top + r}`,
    `L ${rgt} ${bottom}`,
    "Z",
  ].join(" ");
}

function PriceLine({ trend }: { trend: CommunityTrendPoint[] }) {
  const H = 190;
  const priced = trend.filter((t) => t.avgUnitPricePerPing !== null);
  if (priced.length === 0) {
    return <p className="py-6 text-sm text-slate-400">尚無單價資料</p>;
  }
  const wan = (v: number) => v / 10000;
  const vals = priced.map((t) => wan(t.avgUnitPricePerPing!));
  const lo = Math.floor(Math.min(...vals) * 0.95);
  const hi = Math.ceil(Math.max(...vals) * 1.05);
  const span = hi - lo || 1;
  const yOf = (v: number) =>
    PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - lo) / span);

  const pts = trend
    .map((t, i) =>
      t.avgUnitPricePerPing === null
        ? null
        : { x: xOf(i, trend.length), y: yOf(wan(t.avgUnitPricePerPing)), v: wan(t.avgUnitPricePerPing), season: t.season }
    )
    .filter((p) => p !== null);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const last = pts[pts.length - 1];
  const gridVals = [lo, lo + span / 2, hi];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="每坪均價走勢（萬/坪）">
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeWidth={1} />
          <text x={PAD.left - 8} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill={MUTED}>
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      {trend.map((t, i) => (
        <text key={t.season} x={xOf(i, trend.length)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
          {t.season}
        </text>
      ))}
      <path d={path} fill="none" stroke={BLUE} strokeWidth={2} />
      {pts.map((p) => (
        <circle key={p.season} cx={p.x} cy={p.y} r={4} fill={BLUE} stroke="#ffffff" strokeWidth={2}>
          <title>{`${p.season}：${p.v.toFixed(1)} 萬/坪`}</title>
        </circle>
      ))}
      <text x={last.x} y={last.y - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#334155">
        {last.v.toFixed(1)} 萬
      </text>
    </svg>
  );
}

function CountBars({ trend }: { trend: CommunityTrendPoint[] }) {
  const H = 130;
  const max = Math.max(...trend.map((t) => t.count), 1);
  const baseline = H - PAD.bottom;
  const barW = Math.min(((W - PAD.left - PAD.right) / trend.length) * 0.45, 36);
  const hOf = (c: number) => ((baseline - PAD.top) * c) / max;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="各季成交筆數">
      <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} stroke={GRID} strokeWidth={1} />
      {trend.map((t, i) => {
        const cx = xOf(i, trend.length);
        const top = baseline - hOf(t.count);
        return (
          <g key={t.season}>
            {t.count > 0 && (
              <path d={barPath(cx, top, baseline, barW)} fill={BLUE}>
                <title>{`${t.season}：${t.count} 筆`}</title>
              </path>
            )}
            <text x={cx} y={top - 5} textAnchor="middle" fontSize={11} fill={MUTED}>
              {t.count}
            </text>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
              {t.season}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CommunityTrend({ trend }: { trend: CommunityTrendPoint[] }) {
  if (trend.length === 0) {
    return <p className="py-6 text-sm text-slate-400">尚無成交資料</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 text-sm font-medium text-slate-600">每坪均價（萬/坪）</h3>
        <PriceLine trend={trend} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium text-slate-600">成交筆數</h3>
        <CountBars trend={trend} />
      </div>
    </div>
  );
}
