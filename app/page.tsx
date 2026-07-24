"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const QUICK_TERMS = ["草悟道", "七期", "逢甲", "西屯區", "住宅大樓"];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const onSearch = () => {
    const term = q.trim();
    if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
      return;
    }
    router.push("/search");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-6 py-10 text-center">
      <div className="w-full max-w-4xl rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/20 backdrop-blur-sm">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">台中實價查詢</p>
          <h1 className="mt-3 text-5xl font-bold text-slate-900 sm:text-6xl">
            找社區、生活圈、成交趨勢，
            <span className="text-sky-600">從精準搜尋開始</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            避免首頁一次載入整個台中市，先以小範圍、行政區或生活圈為入口，快速找出您想要的社區和房價資訊。
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="home-search" className="sr-only">
              搜尋社區、生活圈或建商
            </label>
            <input
              id="home-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="搜尋社區、生活圈或建商，例如：草悟道 / 惠宇"
              className="min-w-0 flex-1 rounded-3xl border border-slate-300 bg-slate-50 px-5 py-4 text-lg text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="button"
              onClick={onSearch}
              className="inline-flex items-center justify-center rounded-3xl bg-slate-900 px-8 py-4 text-lg font-semibold text-white transition hover:bg-slate-700"
            >
              立即搜尋
            </button>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm text-slate-500">
            <span>熱門搜尋：</span>
            {QUICK_TERMS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => router.push(`/search?q=${encodeURIComponent(term)}`)}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 transition hover:border-slate-300 hover:bg-slate-200"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/search"
            className="rounded-3xl border border-slate-200 bg-sky-50 px-6 py-6 text-left transition hover:border-sky-300"
          >
            <p className="text-sm font-semibold text-slate-900">精準搜尋</p>
            <p className="mt-2 text-slate-600">按社區名稱、建商或生活圈來篩選，先縮小範圍再進地圖查看。</p>
          </Link>
          <Link
            href="/map"
            className="rounded-3xl border border-slate-200 bg-white px-6 py-6 text-left transition hover:border-slate-300"
          >
            <p className="text-sm font-semibold text-slate-900">查看台中地圖</p>
            <p className="mt-2 text-slate-600">直接開啟地圖，快速瀏覽最新成交點與社區圖層。</p>
          </Link>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        資料來源：內政部不動產成交案件實際資訊資料供應系統
      </p>
    </main>
  );
}
