"use client";

// 社區搜尋框（autocomplete）：輸入建案名稱，選擇後進入社區分析頁

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommunityHit, RegistryHit } from "@/lib/types";

export default function CommunitySearch({
  onArea,
}: {
  /** 點擊區域標題時把地圖移到該區（地圖頁傳入） */
  onArea?: (lat: number, lng: number) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CommunityHit[]>([]);
  const [registryHits, setRegistryHits] = useState<RegistryHit[]>([]);
  const [area, setArea] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  const [nearby, setNearby] = useState<CommunityHit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setHits([]);
        setRegistryHits([]);
        setArea(null);
        setNearby([]);
        setOpen(false);
        return;
      }
      const res = await fetch(`/api/communities?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.communities);
        setRegistryHits(data.registry ?? []);
        setArea(data.area ?? null);
        setNearby(data.nearby ?? []);
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
      <div className="flex items-center gap-2">
        <input
          type="search"
          aria-label="搜尋社區、生活圈或建商"
          placeholder="搜尋社區、生活圈或建商，例如：草悟道 / 惠宇"
          className="w-64 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && hits.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const term = q.trim();
            if (!term) return;
            e.preventDefault();
            if (area && nearby.length > 0 && onArea) {
              setOpen(false);
              onArea(area.latitude, area.longitude);
              return;
            }
            if (hits.length > 0) {
              setOpen(false);
              router.push(`/community/${hits[0].id}`);
              return;
            }
            if (registryHits.length > 0) {
              setOpen(false);
              router.push(`/registry/${registryHits[0].id}`);
            }
          }}
        />
        {q && (
          <button
            type="button"
            className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-600 hover:bg-slate-200"
            onClick={() => {
              setQ("");
              setHits([]);
              setRegistryHits([]);
              setArea(null);
              setNearby([]);
              setOpen(false);
            }}
          >
            清除
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute left-0 top-full z-[1100] mt-1 max-h-80 w-72 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {/* 區域關鍵字命中：附近社區 */}
          {area && nearby.length > 0 && (
            <>
              <li>
                <button
                  className="w-full bg-sky-50 px-3 py-1.5 text-left text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                  onClick={() => {
                    if (onArea) {
                      setOpen(false);
                      onArea(area.latitude, area.longitude);
                    }
                  }}
                >
                  📍 {area.name}｜附近社區
                  {onArea ? "（點此移動地圖）" : ""}
                </button>
              </li>
              {nearby.map((h) => (
                <li key={`n-${h.id}`}>
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
              ))}
            </>
          )}
          {hits.length === 0 && registryHits.length === 0 && nearby.length === 0 ? (
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
                    {h.builder && (
                      <span className="ml-1 text-[10px] font-normal text-slate-400">
                        {h.builder}
                      </span>
                    )}
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
          {/* 官方名冊中尚未綁定門牌的社區：點擊進名冊頁連結門牌 */}
          {registryHits.length > 0 && (
            <>
              <li className="border-t border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-400">
                官方名冊（點擊以連結門牌）
              </li>
              {registryHits.map((h) => (
                <li key={h.id}>
                  <button
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/registry/${h.id}`);
                    }}
                  >
                    <span className="text-slate-600">
                      {h.name}
                      <span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-600">
                        名冊
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {h.district}
                      {h.households ? `｜${h.households} 戶` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
