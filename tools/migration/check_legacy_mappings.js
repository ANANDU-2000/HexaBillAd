const requireEnv = require('./require-env');
const databaseUrl = process.env.HEXABILL_DB_URL || requireEnv('DATABASE_URL');
const { Client } = require('pg');

async function run() {
  const connStr = databaseUrl;
  const client = new Client({ connectionString: connStr });
  await client.connect();

  const custRes = await client.query('SELECT COUNT(*) as total, COUNT("DestinationCustomerId") as mapped FROM "LegacyCustomers" WHERE "TenantId" = 20;');
  console.log('LegacyCustomers count:', custRes.rows[0]);

  const mapRes = await client.query('SELECT COUNT(*) as total FROM "LegacyCustomerMappings" WHERE "TenantId" = 20;');
  console.log('LegacyCustomerMappings count:', mapRes.rows[0]);

  const samples = await client.query('SELECT "SourceCustomerId", "Name", "DestinationCustomerId" FROM "LegacyCustomers" WHERE "TenantId" = 20 LIMIT 5;');
  console.log('LegacyCustomers sample:', samples.rows);

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
