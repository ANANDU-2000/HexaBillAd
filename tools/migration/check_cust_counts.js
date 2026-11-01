const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require('pg');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const cRes = await client.query('SELECT count(*) FROM public."LegacyCustomers" WHERE "TenantId" = 20');
  const oRes = await client.query('SELECT count(*), sum("OpeningBalance") FROM public."LegacyOpeningReceivables" WHERE "TenantId" = 20');
  const mRes = await client.query('SELECT count(*) FROM public."LegacyCustomers" WHERE "TenantId" = 20 AND "DestinationCustomerId" IS NOT NULL');
  console.log('LegacyCustomers:', cRes.rows[0]);
  console.log('OpeningReceivables:', oRes.rows[0]);
  console.log('MappedCustomers:', mRes.rows[0]);

  // Check customer 136 specifically
  const c136 = await client.query('SELECT * FROM public."LegacyCustomers" WHERE "TenantId" = 20 AND ("DestinationCustomerId" = 136 OR "SourceCustomerId" = 24)');
  console.log('Customer 136 mapping:', c136.rows);

  const inv136 = await client.query('SELECT count(*), sum("GrandTotal"), sum("PaidAmount"), sum("OutstandingCalculated") FROM public."LegacyInvoices" WHERE "TenantId" = 20 AND ("DestinationCustomerId" = 136 OR "SourceCustomerId" = 24)');
  console.log('Invoices for 136:', inv136.rows[0]);

  const unpaid136 = await client.query('SELECT "LegacyInvoiceNumber", "InvoiceDate", "GrandTotal", "PaidAmount", "OutstandingCalculated" FROM public."LegacyInvoices" WHERE "TenantId" = 20 AND ("DestinationCustomerId" = 136 OR "SourceCustomerId" = 24) AND "OutstandingCalculated" > 0.005 ORDER BY "InvoiceDate" DESC');
  console.log('Unpaid invoices for 136:', unpaid136.rows);

  await client.end();
}
run().catch(console.error);

