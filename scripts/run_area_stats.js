require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Client } = require('pg');
const AREAS = {
  '草悟道': { name: '草悟道', latitude: 24.1500, longitude: 120.6640, radiusKm: 0.9 },
  '勤美': { name: '草悟道', latitude: 24.1500, longitude: 120.6640, radiusKm: 0.9 },
  '七期': { name: '七期重劃區（市政特區）', latitude: 24.1617, longitude: 120.6469, radiusKm: 1.6 },
};

function matchArea(q) {
  return AREAS[q] ?? null;
}

const SQM_TO_PING = 3.3058;

async function main() {
  const areaQ = process.argv[2] || '草悟道';
  const area = matchArea(areaQ);
  if (!area) {
    console.error('unknown area', areaQ);
    process.exit(1);
  }
  const lat = area.latitude;
  const lng = area.longitude;
  const radius = area.radiusKm;
  const includePresale = (process.env.INCLUDE_PRESALE ?? 'true') === 'true';
  const presaleCond = includePresale ? "(category = 'sale' OR category = 'presale')" : "(category = 'sale')";

  const statsSql = `WITH base AS (
      SELECT *, (6371 * acos( cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= $3
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
      SELECT *, (6371 * acos( cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= $3
      AND ${presaleCond}
    )
    SELECT to_char(date_trunc('month', "transactionDate"), 'YYYY-MM') AS month,
           count(*) AS cnt,
           avg("unitPrice" * ${SQM_TO_PING}) AS avg_unit_price_per_ping
    FROM filtered
    GROUP BY month
    ORDER BY month;`;

  const compareSql = `WITH base AS (
      SELECT *, (6371 * acos( cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)) )) AS dist_km
      FROM "Transaction"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ), filtered AS (
      SELECT * FROM base
      WHERE dist_km <= $3
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
      SELECT *, (6371 * acos( cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)) )) AS dist_km
      FROM base
    ) t WHERE dist_km <= $3;`;

  let connStr = process.env.DATABASE_URL || '';
  if (connStr.includes('${')) {
    // .env still contains placeholders — attempt to build from POSTGRES_* env vars
    const user = process.env.POSTGRES_USERNAME || process.env.POSTGRES_USER;
    const pass = process.env.POSTGRES_PASSWORD;
    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT;
    const db = process.env.POSTGRES_DATABASE;
    if (!user || !pass || !host || !port || !db) {
      console.error('DATABASE_URL contains placeholders and POSTGRES_* variables are not all set. Please update .env or set POSTGRES_* env vars.');
      process.exit(1);
    }
    connStr = `postgresql://${user}:${pass}@${host}:${port}/${db}?schema=public`;
  }

  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    const statsRes = await client.query(statsSql, [lat, lng, radius]);
    const seriesRes = await client.query(seriesSql, [lat, lng, radius]);
    const compareRes = await client.query(compareSql, [lat, lng, radius]);
    const communityRes = await client.query(communitySql, [lat, lng, radius]);

    console.log('area:', area.name);
    console.log('stats:', statsRes.rows[0]);
    console.log('compare:', compareRes.rows[0]);
    console.log('communityCount:', communityRes.rows[0] && communityRes.rows[0].community_count);
    console.log('series sample (first 10 rows):', seriesRes.rows.slice(0, 10));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

main();
