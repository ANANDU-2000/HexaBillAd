const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require('pg');
const connStr = databaseUrl;

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT s."Id", s."InvoiceNo", s."InvoiceDate", s."CreatedAt", s."CustomerId", c."Name" as "CustomerName", s."GrandTotal", s."IsDeleted"
    FROM "public"."Sales" s
    LEFT JOIN "public"."Customers" c ON c."Id" = s."CustomerId"
    WHERE s."TenantId" = 20
    ORDER BY s."InvoiceDate" ASC, s."CreatedAt" ASC, s."Id" ASC;
  `);
  console.log('Total sales for Tenant 20:', res.rows.length);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);

