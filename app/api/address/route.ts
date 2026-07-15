// 地址分析端點：某個門牌（正規化地址）的完整成交歷史與統計
// GET /api/address?q=臺中市南區和昌街156號

import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });

  const rows = await prisma.transaction.findMany({
    where: { normalizedAddress: q },
    orderBy: { transactionDate: "desc" },
  });

  const withUnitPrice = rows.filter((r) => r.unitPrice);
  const avgUnitPricePerPing = withUnitPrice.length
    ? Math.round(
        (withUnitPrice.reduce((sum, r) => sum + r.unitPrice!, 0) /
          withUnitPrice.length) *
          3.3058
      )
    : null;

  return Response.json({
    address: q,
    count: rows.length,
    avgUnitPricePerPing,
    transactions: rows.map((r) => ({
      ...r,
      totalPrice: Number(r.totalPrice),
      parkingPrice: r.parkingPrice === null ? null : Number(r.parkingPrice),
      unitPricePerPing: r.unitPrice ? Math.round(r.unitPrice * 3.3058) : null,
      areaPing: r.buildingArea
        ? Math.round(r.buildingArea * 0.3025 * 100) / 100
        : null,
    })),
  });
}
