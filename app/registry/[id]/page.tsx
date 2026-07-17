// 官方名冊社區頁：尚未綁定門牌的名冊社區入口（從搜尋下拉點進來）
// 已綁定的名冊直接轉向對應的社區分析頁

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RegistryLocate from "@/components/RegistryLocate";

export const dynamic = "force-dynamic";

export default async function RegistryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registry = await prisma.condoRegistry.findUnique({
    where: { id },
    include: { bindings: { select: { clusterKey: true } } },
  });
  if (!registry) notFound();

  if (registry.bindings.length) {
    const community = await prisma.community.findFirst({
      where: { registryId: registry.id, source: "address" },
      select: { id: true },
    });
    if (community) redirect(`/community/${community.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-4 text-sm">
        <Link href="/map" className="text-blue-600 hover:underline">
          ← 回地圖
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {registry.name}
          <span className="ml-2 align-middle rounded bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-600">
            官方名冊
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          臺中市{registry.district}
          {registry.households ? `｜${registry.households} 戶` : ""}
          {registry.orgType ? `｜${registry.orgType}` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          資料來源：臺中市公寓大廈報備資料
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-800">這個社區還沒連結門牌</h2>
        <p className="mt-1 text-sm text-slate-500">
          名冊只記錄社區名稱與戶數，還不知道它對應哪個門牌。
          如果你知道這個社區的地址，搜尋門牌把它連結起來，
          成交行情、價格趨勢就會掛到這個社區名下。
        </p>
        <RegistryLocate
          registryId={registry.id}
          registryName={registry.name}
          district={registry.district}
        />
      </section>
    </main>
  );
}
