"use client";

// 名冊頁的門牌連結元件：搜尋中古門牌社區 → 選定後綁定 → 跳轉社區分析頁
// （與社區頁的 RegistryBind 相反方向：從名冊出發找門牌）

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommunityHit } from "@/lib/types";

interface Props {
  registryId: string;
  registryName: string;
  district: string;
}

export default function RegistryLocate({ registryId, registryName, district }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CommunityHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setHits([]);
        setOpen(false);
        return;
      }
      const res = await fetch(`/api/communities?q=${encodeURIComponent(term)}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        // 只能綁中古門牌社區；同行政區排前面（跨區通常是誤選）
        const sorted = (data.communities as CommunityHit[])
          .filter((c) => c.source === "address")
          .sort(
            (a, b) =>
              Number(b.district === district) - Number(a.district === district)
          );
        setHits(sorted);
        setOpen(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, district]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function bind(hit: CommunityHit) {
    if (!confirm(`確定「${registryName}」的門牌是「${hit.name}」（${hit.district}）？`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/communities/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registryId, communityId: hit.id }),
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.communityId) {
      router.push(`/community/${data.communityId}`);
    } else {
      setError(data?.error ?? "綁定失敗，請稍後再試");
    }
  }

  return (
    <div ref={boxRef} className="relative mt-3">
      <input
        type="search"
        placeholder="輸入這個社區的路名或門牌（如：文心路四段）"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {open && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">
              找不到符合的門牌社區（只有近年有成交的集合住宅會出現）
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => bind(h)}
                  disabled={busy}
                >
                  <span className="font-medium text-slate-800">{h.name}</span>
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
