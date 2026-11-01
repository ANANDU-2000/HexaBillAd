const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require('pg');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const res = await client.query('SELECT "Id", "InvoiceNumber", "InvoiceDate", "GrandTotal", "CreatedAt" FROM "Sales" WHERE "TenantId" = 20 ORDER BY "InvoiceDate" DESC, "Id" DESC LIMIT 25;');
  console.log("Current Sales for Tenant 20:", res.rows);
  await client.end();
}
run().catch(console.error);

