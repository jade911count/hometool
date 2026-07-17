// 社區分析頁（foundi 對標）：社區資訊、戶數、建商、屋齡、平均成交、
// 最近成交、成交趨勢、每坪價格、成交筆數 + 成交明細
// Stage 1：資料來源為預售屋實價登錄；戶數／建商待使照資料階段補齊

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunityDetail } from "@/lib/community";
import { floorLabel } from "@/lib/floors";
import CommunityTrend from "@/components/CommunityTrend";
import RegistryBind from "@/components/RegistryBind";

export const dynamic = "force-dynamic";

function fmtWan(price: number): string {
  return `${Math.round(price / 10000).toLocaleString()} 萬`;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 屋齡：有建築完成年月則計算年數，預售案通常尚未完工 */
function ageLabel(completionDate: Date | null): string {
  if (!completionDate) return "預售／新成屋";
  const years = Math.floor(
    (Date.now() - completionDate.getTime()) / (365.25 * 24 * 3600 * 1000)
  );
  return years <= 0 ? "1 年內" : `${years} 年`;
}

const PENDING = "資料建置中";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCommunityDetail(id);
  if (!c) notFound();

  const stats: { label: string; value: string; note?: string }[] = [
    { label: "戶數", value: c.households ? `${c.households} 戶` : PENDING },
    { label: "建商", value: c.builder ?? PENDING },
    {
      label: "屋齡",
      value:
        !c.completionDate && c.source === "address"
          ? "—"
          : ageLabel(c.completionDate),
    },
    {
      label: "平均成交",
      value: c.avgTotalPrice ? fmtWan(c.avgTotalPrice) : "—",
    },
    {
      label: "最近成交",
      value: c.lastDeal ? fmtWan(c.lastDeal.totalPrice) : "—",
      note: c.lastDeal ? fmtDate(c.lastDeal.date) : undefined,
    },
    {
      label: "每坪價格",
      value: c.avgUnitPricePerPing
        ? `${(c.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
        : "—",
    },
    { label: "成交筆數", value: `${c.txCount} 筆` },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <nav className="mb-4 text-sm">
        <Link href="/map" className="text-blue-600 hover:underline">
          ← 回地圖
        </Link>
      </nav>

      {/* 社區資訊 */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {c.name}
          <span className="ml-2 align-middle rounded bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
            {c.source === "address" ? "中古" : "預售"}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          臺中市{c.district}
          {c.address ? `｜${c.address}` : ""}
          {c.buildingType ? `｜${c.buildingType}` : ""}
        </p>
        {c.source === "address" ? (
          <>
            {!c.registry && (
              <p className="mt-1 text-xs text-slate-400">
                資料來源：內政部實價登錄（中古買賣）。社區名稱尚未建檔，暫以門牌代稱
              </p>
            )}
            <RegistryBind
              communityId={c.id}
              district={c.district}
              bound={c.registry}
            />
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            資料來源：內政部實價登錄（預售屋），已排除解約案件
          </p>
        )}
      </header>

      {/* 統計卡 */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="text-xs text-slate-500">{s.label}</div>
            <div
              className={`mt-1 text-lg font-semibold ${
                s.value === PENDING ? "text-slate-400" : "text-slate-800"
              }`}
            >
              {s.value}
            </div>
            {s.note && <div className="text-xs text-slate-400">{s.note}</div>}
          </div>
        ))}
      </section>

      {/* 成交趨勢 */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold text-slate-800">成交趨勢</h2>
        <CommunityTrend trend={c.trend} />
      </section>

      {/* 成交明細 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold text-slate-800">
          成交明細 <span className="text-sm font-normal text-slate-400">共 {c.txCount} 筆</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">成交日</th>
                <th className="py-2 pr-3 font-medium">棟及號</th>
                <th className="py-2 pr-3 font-medium">樓層</th>
                <th className="py-2 pr-3 font-medium">格局</th>
                <th className="py-2 pr-3 font-medium">坪數</th>
                <th className="py-2 pr-3 font-medium">每坪單價</th>
                <th className="py-2 pr-3 font-medium">總價</th>
                <th className="py-2 font-medium">車位</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.deals.map((d) => (
                <tr key={d.serialNo} className="text-slate-700">
                  <td className="py-2 pr-3">{fmtDate(d.transactionDate)}</td>
                  <td className="py-2 pr-3">{d.buildingUnit ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {d.floor ? `${floorLabel(d.floor)}${d.totalFloors ? ` / ${d.totalFloors}F` : ""}` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {[d.rooms, d.halls, d.baths].every((v) => v === null)
                      ? "—"
                      : `${d.rooms ?? 0}房${d.halls ?? 0}廳${d.baths ?? 0}衛`}
                  </td>
                  <td className="py-2 pr-3">{d.areaPing ? `${d.areaPing} 坪` : "—"}</td>
                  <td className="py-2 pr-3">
                    {d.unitPricePerPing
                      ? `${(d.unitPricePerPing / 10000).toFixed(1)} 萬`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 font-medium">{fmtWan(d.totalPrice)}</td>
                  <td className="py-2">{d.parkingType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
