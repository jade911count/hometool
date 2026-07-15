"use client";

// Leaflet 只能在瀏覽器執行，關閉 SSR 後動態載入地圖元件
import dynamic from "next/dynamic";

const TransactionMap = dynamic(() => import("@/components/TransactionMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-slate-500">
      地圖載入中…
    </div>
  ),
});

export default function MapPage() {
  return <TransactionMap />;
}
