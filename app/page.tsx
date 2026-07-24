import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <h1 className="text-4xl font-bold text-slate-800">hometool</h1>
      <p className="max-w-xl text-slate-600">
        台中市實價登錄地圖——在地圖上瀏覽近兩年的真實成交行情，
        點擊任一門牌即可查看該地址的完整成交歷史與每坪單價。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/search"
          className="rounded-lg bg-slate-800 px-6 py-3 font-medium text-white transition hover:bg-slate-700"
        >
          精準搜尋
        </Link>
        <Link
          href="/map"
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-800 transition hover:bg-slate-50"
        >
          開啟實價地圖
        </Link>
      </div>
      <p className="text-xs text-slate-400">
        資料來源：內政部不動產成交案件實際資訊資料供應系統
      </p>
    </main>
  );
}
