import dynamic from "next/dynamic";

const SearchPage = dynamic(() => import("@/components/SearchPage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      搜尋頁載入中…
    </div>
  ),
});

export default function SearchRoute() {
  return <SearchPage />;
}
