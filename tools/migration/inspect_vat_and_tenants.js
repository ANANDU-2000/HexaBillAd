const requireEnv = require('./require-env');
const databaseUrl = requireEnv('DATABASE_URL');
const { Client } = require("pg");
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const tenants = await client.query('SELECT "Id", "Name", "Subdomain", "TRN", "CreatedAt" FROM "Tenants" ORDER BY "Id";');
  console.log("=== TENANTS ===");
  console.log(JSON.stringify(tenants.rows, null, 2));

  const settingsCols = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'CompanySettings\';');
  console.log("=== COMPANY SETTINGS COLUMNS ===");
  console.log(settingsCols.rows.map(r => r.column_name));

  const settings = await client.query('SELECT * FROM "CompanySettings" ORDER BY "TenantId";');
  console.log("=== COMPANY SETTINGS ===");
  console.log(JSON.stringify(settings.rows, null, 2));

  const salesTax = await client.query('SELECT "Id", "InvoiceNumber", "SubTotal", "TaxAmount", "TaxRate", "GrandTotal", "CreatedAt" FROM "Sales" WHERE "TenantId" = 20 ORDER BY "Id" DESC LIMIT 10;');
  console.log("=== RECENT SALES TENANT 20 ===");
  console.log(JSON.stringify(salesTax.rows, null, 2));

  const legacyTax = await client.query('SELECT "InvoiceNumber", "TotalAmount", "VatAmount", "NetTotal", "Date" FROM "LegacyInvoices" WHERE "TenantId" = 20 ORDER BY "InvoiceNumber"::int DESC LIMIT 5;');
  console.log("=== LEGACY INVOICES TAX SAMPLE ===");
  console.log(JSON.stringify(legacyTax.rows, null, 2));

  const expenses = await client.query('SELECT * FROM "Expenses" WHERE "TenantId" = 20 LIMIT 5;');
  console.log("=== EXPENSES SAMPLE TENANT 20 ===");
  console.log(JSON.stringify(expenses.rows, null, 2));

  await client.end();
}
run().catch(console.error);
