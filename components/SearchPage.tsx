"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommunityHit, RegistryHit } from "@/lib/types";

interface SearchResult {
  communities: CommunityHit[];
  registry: RegistryHit[];
  area: { name: string; latitude: number; longitude: number } | null;
  nearby: CommunityHit[];
}

const EMPTY_RESULT: SearchResult = {
  communities: [],
  registry: [],
  area: null,
  nearby: [],
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const router = useRouter();

  const trimmed = q.trim();
  const canSearch = trimmed.length > 0;

  useEffect(() => {
    if (!canSearch) {
      setResult(EMPTY_RESULT);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/communities?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          throw new Error("無法取得搜尋結果");
        }
        const data = (await res.json()) as SearchResult;
        setResult(data);
      } catch (err) {
        if ((err as any).name !== "AbortError") {
          setError((err as any)?.message ?? "搜尋失敗，請稍後再試");
        }
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, canSearch]);

  const allResults = useMemo(
    () => [...result.communities, ...result.nearby, ...result.registry],
    [result]
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">精準搜尋</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          輸入社區名稱、建商、或生活圈別名，搜尋結果會顯示精準社區、官方名冊以及圈內熱門社區。
          這個頁面專為小範圍查詢而設，避免首頁大範圍資料乾坤一擲。
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="search-input" className="sr-only">
            搜尋社區、生活圈或建商
          </label>
          <input
            id="search-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (canSearch) setSearched(true);
            }}
            placeholder="輸入社區、生活圈或建商，例如：草悟道 / 惠宇"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:w-3/4"
          />
          <button
            type="button"
            disabled={!canSearch}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={() => setSearched(true)}
          >
            搜尋
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">提示</div>
            <p className="mt-2 text-sm text-slate-600">
              可搜尋特定社區名稱、建商名稱，或直接輸入生活圈別名，例如「七期」、「逢甲」、「草悟道」。
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">範圍</div>
            <p className="mt-2 text-sm text-slate-600">
              只回傳與查詢條件高度相關的小範圍結果，而非整個台中市的全部社區。
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">行動</div>
            <p className="mt-2 text-sm text-slate-600">
              點選搜尋結果即可前往社區分析、名冊頁，或繼續在地圖上檢視該生活圈。 
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {!searched ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
            進行搜尋後，結果與小範圍社區推薦會顯示在此。
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <div>
                <p className="text-sm text-slate-500">搜尋關鍵字</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{trimmed}</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                {loading ? "搜尋中…" : `${allResults.length} 個相關結果`}
              </div>
            </div>

            {error && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
                讀取搜尋結果中...
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  {result.area && (
                    <div className="rounded-3xl border border-slate-200 bg-sky-50 p-5">
                      <div className="mb-2 text-sm font-semibold text-slate-900">找到生活圈</div>
                      <div className="text-lg font-bold text-slate-900">{result.area.name}</div>
                      <p className="mt-2 text-sm text-slate-600">
                        這是一個與搜尋條件高度相關的區域，小範圍社區結果會以此為基準。
                      </p>
                    </div>
                  )}
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">社區搜尋結果</div>
                        <div className="text-xs text-slate-500">社區名稱或建商關鍵字比對</div>
                      </div>
                      <div className="text-xs text-slate-400">{result.communities.length} 筆</div>
                    </div>
                    {result.communities.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        沒有符合名稱或建商的社區。若是生活圈搜尋，請嘗試更完整的別名。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {result.communities.map((hit) => (
                          <button
                            key={hit.id}
                            type="button"
                            className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-300"
                            onClick={() => router.push(`/community/${hit.id}`)}
                          >
                            <div className="flex items-center gap-2 text-slate-900">
                              <span className="font-semibold">{hit.name}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {hit.source === "address" ? "中古" : "預售"}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {hit.district}｜{hit.txCount} 筆成交
                              {hit.avgUnitPricePerPing
                                ? `｜${(hit.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
                                : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {result.registry.length > 0 && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">官方名冊建議</div>
                          <div className="text-xs text-slate-500">尚未綁定門牌的名冊社區</div>
                        </div>
                        <div className="text-xs text-slate-400">{result.registry.length} 筆</div>
                      </div>
                      <div className="space-y-3">
                        {result.registry.map((hit) => (
                          <button
                            key={hit.id}
                            type="button"
                            className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-amber-300"
                            onClick={() => router.push(`/registry/${hit.id}`)}
                          >
                            <div className="text-slate-900 font-semibold">{hit.name}</div>
                            <div className="mt-2 text-sm text-slate-500">
                              {hit.district}
                              {hit.households ? `｜${hit.households} 戶` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {result.area && result.nearby.length > 0 && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 text-sm font-semibold text-slate-900">圈內熱門社區</div>
                      <div className="grid gap-3">
                        {result.nearby.map((hit) => (
                          <button
                            key={`nearby-${hit.id}`}
                            type="button"
                            className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-300"
                            onClick={() => router.push(`/community/${hit.id}`)}
                          >
                            <div className="flex items-center gap-2 text-slate-900">
                              <span className="font-semibold">{hit.name}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {hit.source === "address" ? "中古" : "預售"}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {hit.district}｜{hit.txCount} 筆成交
                              {hit.avgUnitPricePerPing
                                ? `｜${(hit.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
                                : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
