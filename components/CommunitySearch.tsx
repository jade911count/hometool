"use client";

// 社區搜尋框（autocomplete）：輸入建案名稱，選擇後進入社區分析頁

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommunityHit } from "@/lib/types";

export default function CommunitySearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CommunityHit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setHits([]);
        setOpen(false);
        return;
      }
      const res = await fetch(`/api/communities?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.communities);
        setOpen(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="search"
        placeholder="輸入社區（建案名稱）"
        className="w-48 rounded border border-slate-300 px-2 py-1"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="absolute left-0 top-full z-[1100] mt-1 max-h-80 w-72 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">找不到符合的社區</li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/community/${h.id}`);
                  }}
                >
                  <span className="font-medium text-slate-800">
                    {h.name}
                    <span
                      className={`ml-1 rounded px-1 py-0.5 text-[10px] font-normal ${
                        h.source === "address"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {h.source === "address" ? "中古" : "預售"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {h.district}｜{h.txCount} 筆
                    {h.avgUnitPricePerPing
                      ? `｜${(h.avgUnitPricePerPing / 10000).toFixed(1)} 萬/坪`
                      : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
