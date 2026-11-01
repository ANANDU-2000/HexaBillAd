const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require('pg');

const connString = databaseUrl;

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Render PostgreSQL!');

  const tenantId = 20;

  // 1. Purchases
  const pCount = await client.query('SELECT COUNT(*) FROM "public"."LegacyPurchases" WHERE "TenantId" = $1;', [tenantId]);
  const pSum = await client.query('SELECT SUM("TotalAmount") FROM "public"."LegacyPurchases" WHERE "TenantId" = $1;', [tenantId]);
  const pSample = await client.query('SELECT * FROM "public"."LegacyPurchases" WHERE "TenantId" = $1 ORDER BY "PurchaseDate" DESC LIMIT 3;', [tenantId]);
  console.log(`Purchases: ${pCount.rows[0].count} rows, Total: AED ${pSum.rows[0].sum}`);
  console.log('Sample purchase:', pSample.rows[0]);

  // 2. Purchase Items
  const piCount = await client.query('SELECT COUNT(*) FROM "public"."LegacyPurchaseItems" WHERE "TenantId" = $1;', [tenantId]);
  const piSample = await client.query('SELECT * FROM "public"."LegacyPurchaseItems" WHERE "TenantId" = $1 AND "SourcePurchaseId" = $2 LIMIT 5;', [tenantId, pSample.rows[0].SourcePurchaseId]);
  console.log(`Purchase Items: ${piCount.rows[0].count} rows`);
  console.log('Items for purchase', pSample.rows[0].SourcePurchaseId, ':', piSample.rows.length);

  // 3. Expenses
  const eCount = await client.query('SELECT COUNT(*) FROM "public"."LegacyExpenses" WHERE "TenantId" = $1;', [tenantId]);
  const eSum = await client.query('SELECT SUM("Amount") FROM "public"."LegacyExpenses" WHERE "TenantId" = $1;', [tenantId]);
  console.log(`Expenses: ${eCount.rows[0].count} rows, Total: AED ${eSum.rows[0].sum}`);

  // 4. Suppliers
  const sRes = await client.query(`
    SELECT "SupplierName", COUNT(*) as purchase_count, SUM("TotalAmount") as total_purchases
    FROM "public"."LegacyPurchases"
    WHERE "TenantId" = $1
    GROUP BY "SupplierName"
    ORDER BY total_purchases DESC
    LIMIT 5;
  `, [tenantId]);
  console.log('Top 5 Suppliers:');
  sRes.rows.forEach(r => console.log(`  - ${r.SupplierName}: ${r.purchase_count} purchases, AED ${r.total_purchases}`));

  await client.end();
}

main().catch(console.error);

