"use client";

// 中古門牌社區的官方名冊綁定元件（詳情頁用）
// 未綁定：搜尋公寓大廈報備名冊 → 選定後綁定，社區獲得正式名稱＋戶數
// 已綁定：顯示來源說明與解除綁定入口

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistryHit } from "@/lib/types";

interface Props {
  communityId: string;
  district: string;
  bound: { id: string; name: string } | null;
}

export default function RegistryBind({ communityId, district, bound }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegistryHit[]>([]);
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
      const res = await fetch(`/api/communities?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        // 同行政區的名冊排前面（跨區綁定通常是誤選）
        const sorted = [...(data.registry as RegistryHit[])].sort(
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

  async function bind(registryId: string, name: string) {
    if (!confirm(`確定將此門牌社區綁定為「${name}」？`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/communities/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registryId, communityId }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "綁定失敗，請稍後再試");
    }
  }

  async function unbind() {
    if (!bound) return;
    if (!confirm(`確定解除與「${bound.name}」的綁定？社區名稱將還原為門牌代稱`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/communities/bind", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registryId: bound.id }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "解除失敗，請稍後再試");
    }
  }

  if (bound) {
    return (
      <p className="mt-1 text-xs text-slate-400">
        社區名稱來自臺中市公寓大廈報備資料（使用者綁定）
        <button
          className="ml-2 text-blue-600 hover:underline disabled:opacity-50"
          onClick={unbind}
          disabled={busy}
        >
          解除綁定
        </button>
        {error && <span className="ml-2 text-red-500">{error}</span>}
      </p>
    );
  }

  return (
    <div ref={boxRef} className="relative mt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">認得這個社區？</span>
        <input
          type="search"
          placeholder="搜尋官方名冊為它命名"
          className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {open && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-72 w-80 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">
              名冊中找不到符合的社區
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => bind(h.id, h.name)}
                  disabled={busy}
                >
                  <span className="font-medium text-slate-800">{h.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {h.district}
                    {h.households ? `｜${h.households} 戶` : ""}
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
