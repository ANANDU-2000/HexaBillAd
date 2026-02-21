/**
 * Verify ZAYOGA migration — run after migrate-zayoga.js
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

function getDbConfig() {
  const connectionString = process.env.DATABASE_URL_EXTERNAL || process.env.DATABASE_URL;
  if (connectionString) {
    const url = new URL(connectionString);
    return {
      connectionString,
      password: url.password ? String(url.password) : '',
      ssl: { rejectUnauthorized: true },
    };
  }
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  return {
    host: process.env.PGHOST || process.env.DB_HOST_EXTERNAL || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: password != null ? String(password) : '',
    database: process.env.PGDATABASE || process.env.DB_NAME || 'hexabill',
  };
}

async function main() {
  const client = new Client(getDbConfig());
  await client.connect();

  const tenantRow = await client.query(
    'SELECT "Id" FROM "Tenants" WHERE "Email" = $1',
    ['info@zayoga.ae']
  );
  if (tenantRow.rows.length === 0) {
    console.log('FAIL: ZAYOGA tenant not found.');
    await client.end();
    process.exit(1);
  }
  const tenantId = tenantRow.rows[0].Id;

  const invoiceCount = await client.query(
    'SELECT COUNT(*) AS c FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
    [tenantId]
  );
  const customerCount = await client.query(
    'SELECT COUNT(*) AS c FROM "Customers" WHERE "TenantId" = $1',
    [tenantId]
  );
  const unpaid = await client.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM("GrandTotal" - "PaidAmount"), 0) AS bal
     FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false AND "PaymentStatus" IN ('Pending', 'Partial')`,
    [tenantId]
  );
  const revenue = await client.query(
    'SELECT COALESCE(SUM("GrandTotal"), 0) AS t FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
    [tenantId]
  );
  const paymentsCount = await client.query(
    'SELECT COUNT(*) AS c FROM "Payments" p INNER JOIN "Sales" s ON p."SaleId" = s."Id" WHERE s."TenantId" = $1 AND s."IsDeleted" = false',
    [tenantId]
  );
  const totalReceivedRow = await client.query(
    `SELECT COALESCE(SUM(p."Amount"), 0) AS t FROM "Payments" p INNER JOIN "Sales" s ON p."SaleId" = s."Id" WHERE s."TenantId" = $1 AND s."IsDeleted" = false AND p."Status" = 'CLEARED'`,
    [tenantId]
  );
  await client.end();

  const invoices = parseInt(invoiceCount.rows[0].c, 10);
  const customers = parseInt(customerCount.rows[0].c, 10);
  const unpaidCount = parseInt(unpaid.rows[0].cnt, 10);
  const outstanding = parseFloat(unpaid.rows[0].bal);
  const totalRevenue = parseFloat(revenue.rows[0].t);
  const payments = parseInt(paymentsCount.rows[0].c, 10);
  const totalReceivedDb = parseFloat(totalReceivedRow.rows[0].t);

  const expected = {
    totalInvoices: 241,
    totalSales: 56513.16,
    totalReceived: 45648.75,
    totalOutstanding: 10864.41,
    paidInvoices: 178,
    unpaidInvoices: 63,
  };
  const paidCount = invoices - unpaidCount;

  console.log('=== ZAYOGA FINAL RECONCILIATION (TenantId=' + tenantId + ') ===\n');
  console.log('                    EXPECTED    DB ACTUAL   MATCH');
  console.log('Total Invoices:      ', expected.totalInvoices, '      ', invoices, '       ', invoices === expected.totalInvoices ? 'YES' : 'NO');
  console.log('Total Sales (AED):   ', expected.totalSales, '  ', totalRevenue.toFixed(2), '  ', Math.abs(totalRevenue - expected.totalSales) < 0.02 ? 'YES' : 'NO');
  console.log('Total Received (AED):', expected.totalReceived, '   ', totalReceivedDb.toFixed(2), '  ', Math.abs(totalReceivedDb - expected.totalReceived) < 0.02 ? 'YES' : 'NO');
  console.log('Total Outstanding:   ', expected.totalOutstanding, '   ', outstanding.toFixed(2), '  ', Math.abs(outstanding - expected.totalOutstanding) < 0.02 ? 'YES' : 'NO');
  console.log('Paid invoices:       ', expected.paidInvoices, '      ', paidCount, '       ', paidCount === expected.paidInvoices ? 'YES' : 'NO');
  console.log('Unpaid invoices:     ', expected.unpaidInvoices, '       ', unpaidCount, '       ', unpaidCount === expected.unpaidInvoices ? 'YES' : 'NO');
  console.log('\nCustomers:', customers, '| Payments (linked):', payments);

  const ok =
    invoices === expected.totalInvoices &&
    Math.abs(totalRevenue - expected.totalSales) < 0.02 &&
    Math.abs(totalReceivedDb - expected.totalReceived) < 0.02 &&
    Math.abs(outstanding - expected.totalOutstanding) < 0.02 &&
    unpaidCount === expected.unpaidInvoices;
  console.log('\n' + (ok ? 'CONFIRMED: DB matches expected totals. UI should show Outstanding = 10,864.41 AED, 63 unpaid.' : 'MISMATCH: Compare DB vs expected above.'));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
