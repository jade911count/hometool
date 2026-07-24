import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { matchArea } from '@/lib/areas';

const SQM_TO_PING = 3.3058;

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const areaQ = url.searchParams.get('area') ?? '';
    if (!areaQ) return NextResponse.json({ error: 'area query required' }, { status: 400 });

    const area = matchArea(areaQ);
    if (!area) return NextResponse.json({ error: 'unknown area' }, { status: 400 });

    const lat = area.latitude;
    const lng = area.longitude;
    const radius = area.radiusKm;
    const includePresale = (process.env.INCLUDE_PRESALE ?? 'true') === 'true';

    // Build SQL with a local CTE that computes distance (km) via haversine
    const presaleCond = includePresale ? "(category = 'sale' OR category = 'presale')" : "(category = 'sale')";

    const statsSql = `WITH base AS (
      SELECT *, (6371 * acos( cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= ${radius}
      AND ${presaleCond}
    )
    SELECT
      (SELECT count(*) FROM filtered) AS tx_count,
      (SELECT avg("unitPrice" * ${SQM_TO_PING}) FROM filtered) AS avg_unit_price_per_ping,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "unitPrice" * ${SQM_TO_PING}) FROM filtered) AS median_unit_price_per_ping,
      (SELECT stddev_pop("unitPrice" * ${SQM_TO_PING}) FROM filtered) AS stddev_unit_price_per_ping,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "totalPrice") FROM filtered) AS median_total_price
    `;

    const seriesSql = `WITH base AS (
      SELECT *, (6371 * acos( cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= ${radius}
      AND ${presaleCond}
    )
    SELECT to_char(date_trunc('month', "transactionDate"), 'YYYY-MM') AS month,
           count(*) AS cnt,
           avg("unitPrice" * ${SQM_TO_PING}) AS avg_unit_price_per_ping
    FROM filtered
    GROUP BY month
    ORDER BY month;`;

    const compareSql = `WITH base AS (
      SELECT *, (6371 * acos( cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= ${radius}
      AND ${presaleCond}
    )
    SELECT
      (SELECT avg("unitPrice" * ${SQM_TO_PING}) FROM filtered WHERE "transactionDate" >= now() - interval '1 year') AS avg_1y,
      (SELECT count(*) FROM filtered WHERE "transactionDate" >= now() - interval '1 year') AS cnt_1y,
      (SELECT avg("unitPrice" * ${SQM_TO_PING}) FROM filtered WHERE "transactionDate" >= now() - interval '5 year') AS avg_5y,
      (SELECT count(*) FROM filtered WHERE "transactionDate" >= now() - interval '5 year') AS cnt_5y
    `;

    const communitySql = `WITH base AS (
      SELECT id, latitude, longitude FROM "Community" WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    )
    SELECT count(*) AS community_count FROM (
      SELECT *, (6371 * acos( cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)) )) AS dist_km
      FROM base
    ) t WHERE dist_km <= ${radius};`;

    const statsRows: any = await prisma.$queryRawUnsafe(statsSql);
    const seriesRes: any = await prisma.$queryRawUnsafe(seriesSql);
    const compareRows: any = await prisma.$queryRawUnsafe(compareSql);
    const communityRows: any = await prisma.$queryRawUnsafe(communitySql);
    const statsResRow = Array.isArray(statsRows) ? statsRows[0] : statsRows;
    const compareResRow = Array.isArray(compareRows) ? compareRows[0] : compareRows;
    const communityResRow = Array.isArray(communityRows) ? communityRows[0] : communityRows;

    const result = {
      area: area.name,
      center: { lat, lng },
      radiusKm: radius,
      stats: {
        txCount: parseInteger(statsResRow?.tx_count ?? null),
        avgUnitPricePerPing: parseNumber(statsResRow?.avg_unit_price_per_ping ?? null),
        medianUnitPricePerPing: parseNumber(statsResRow?.median_unit_price_per_ping ?? null),
        stddevUnitPricePerPing: parseNumber(statsResRow?.stddev_unit_price_per_ping ?? null),
        medianTotalPrice: parseNumber(statsResRow?.median_total_price ?? null),
      },
      series: (Array.isArray(seriesRes) ? seriesRes : []).map((row: any) => ({
        month: row.month,
        cnt: parseInteger(row.cnt ?? null),
        avgUnitPricePerPing: parseNumber(row.avg_unit_price_per_ping ?? null),
      })),
      compare: {
        avg1y: parseNumber(compareResRow?.avg_1y ?? null),
        cnt1y: parseInteger(compareResRow?.cnt_1y ?? null),
        avg5y: parseNumber(compareResRow?.avg_5y ?? null),
        cnt5y: parseInteger(compareResRow?.cnt_5y ?? null),
      },
      communityCount: parseInteger(communityResRow?.community_count ?? null) ?? 0,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('areas/stats error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
