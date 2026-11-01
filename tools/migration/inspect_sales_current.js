const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require('pg');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const res = await client.query('SELECT "Id", "InvoiceNumber", "CreatedAt", "TotalAmount", "Status", "IsDeleted" FROM "Sales" WHERE "TenantId" = 20 ORDER BY "CreatedAt" ASC;');
  console.log(`Found ${res.rows.length} sales:`);
  console.table(res.rows);
  await client.end();
}
run().catch(console.error);

