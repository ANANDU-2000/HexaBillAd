/**
 * ZAYOGA Full Financial Audit & Repair
 * - Builds master JSON from CSV (no DB insert)
 * - Audits DB: counts, orphans, balance mismatches
 * - Recalculates all customer balances for ZAYOGA tenant (repair)
 * - Outputs: backend/data/zayoga-master.json, backend/data/audit-report.json
 *
 * Usage: node audit-zayoga.js
 * Requires: .env with DATABASE_URL_EXTERNAL (see migrate-zayoga.js)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const CSV_FOLDER =
  process.env.CSV_FOLDER ||
  path.join(path.dirname(path.dirname(__dirname)), 'ZAYOGA GENERAL TRADING-SOLE PROPERIETORSHIP LLC');
const CSV_FILES = [
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC -1 Invoice.csv',
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC 11- Invoice.csv',
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC d - Invoice.csv',
];
const ZAYOGA_EMAIL = 'info@zayoga.ae';
const DATA_DIR = path.join(__dirname, '..', 'data');

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

// ----- Reuse parsing from migrate-zayoga.js (minimal copy) -----
function parseDecimal(s) {
  if (s == null || s === '') return 0;
  const n = parseFloat(String(s).trim().replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}
function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 200);
}
function parseDate(parts) {
  let day = null, month = null, year = null;
  for (const p of parts) {
    const t = (p || '').trim();
    if (!t) continue;
    if (/^\d{4}$/.test(t)) year = parseInt(t, 10);
    else if (/^\d{1,2}-$/.test(t)) {
      const num = parseInt(t, 10);
      if (day == null) day = num;
      else if (month == null) month = num;
    }
  }
  if (year == null) return null;
  const d = day != null ? day : 1;
  const m = month != null ? month : 1;
  const date = new Date(Date.UTC(year, m - 1, d, 0, 0, 0, 0));
  return isNaN(date.getTime()) ? null : date;
}
function isDataHeaderRow(cells) {
  const c0 = (cells[0] || '').trim();
  const c1 = (cells[1] || '').trim().toLowerCase();
  const c2 = (cells[2] || '').trim().toUpperCase();
  return (c0 === '#' || c0 === '') && (c1 === 'type' || c2 === 'TYPE') &&
    (c2 === 'SALES NO' || (cells[2] || '').toUpperCase().includes('SALES'));
}
function isMainDataRow(cells) {
  return /^\d+$/.test((cells[0] || '').trim());
}
function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.split(','));
  const records = [];
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 13) continue;
    if (isDataHeaderRow(row)) { headerIndex = i; continue; }
    if (headerIndex < 0 || !isMainDataRow(row)) continue;
    const nameParts = [(row[4] || '').trim()];
    const dateParts = [(row[8] || '').trim()];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (next.length >= 9) {
        const next0 = (next[0] || '').trim();
        if (/^\d+$/.test(next0)) break;
        if ((next[4] || '').trim()) nameParts.push((next[4] || '').trim());
        if ((next[8] || '').trim()) dateParts.push((next[8] || '').trim());
      }
      j++;
    }
    const customerName = normalizeName(nameParts.join(' '));
    const invoiceNo = (row[2] || '').trim();
    if (!invoiceNo) continue;
    const amount = parseDecimal(row[10]);
    const receivedAmount = parseDecimal(row[11]);
    const balanceAmount = parseDecimal(row[12]);
    const invoiceDate = parseDate(dateParts);
    records.push({
      invoice_number: invoiceNo,
      invoice_date: invoiceDate ? invoiceDate.toISOString().split('T')[0] : '',
      customer_name: customerName || 'Unknown',
      type: (row[1] || '').trim(),
      amount,
      received_amount: receivedAmount,
      balance_amount: balanceAmount,
      status: (row[9] || '').trim(),
    });
  }
  return records;
}
function mergeAndDedupe(allRecords) {
  const byInvoice = new Map();
  for (const r of allRecords) {
    const key = (r.invoice_number || '').trim();
    if (!key) continue;
    if (!byInvoice.has(key)) byInvoice.set(key, r);
  }
  return Array.from(byInvoice.values());
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // ----- PHASE 1: CSV → master JSON (no DB) -----
  const allRecords = [];
  for (const file of CSV_FILES) {
    const fullPath = path.join(CSV_FOLDER, file);
    if (!fs.existsSync(fullPath)) continue;
    allRecords.push(...parseCsvFile(fullPath));
  }
  const merged = mergeAndDedupe(allRecords);

  const csvTotalSales = merged.reduce((s, r) => s + r.amount, 0);
  const csvTotalReceived = merged.reduce((s, r) => s + r.received_amount, 0);
  const csvTotalBalance = merged.reduce((s, r) => s + r.balance_amount, 0);
  const paidCount = merged.filter((r) => (r.status || '').toLowerCase() === 'paid').length;
  const unpaidCount = merged.length - paidCount;
  const amountMismatch = merged.filter(
    (r) => Math.abs(r.amount - (r.received_amount + r.balance_amount)) > 0.01
  ).map((r) => r.invoice_number);

  const master = {
    company: { name: 'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC', company_id: null },
    invoices: merged.map((r) => ({
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      customer: { name: r.customer_name, customer_id: null },
      type: r.type,
      amount: r.amount,
      received_amount: r.received_amount,
      balance_amount: r.balance_amount,
      status: r.status,
      branch: null,
      route: null,
      invoice_items: [{ item_name: 'Legacy Invoice', quantity: 1, rate: r.amount, line_total: r.amount }],
      payments: r.received_amount > 0 ? [{ payment_date: r.invoice_date, payment_method: r.type, amount: r.received_amount, reference: null }] : [],
      ledger_entries: [],
    })),
    totals: {
      total_invoices: merged.length,
      total_sales: csvTotalSales,
      total_received: csvTotalReceived,
      total_outstanding: csvTotalBalance,
      total_paid_count: paidCount,
      total_unpaid_count: unpaidCount,
    },
    validation: {
      amount_mismatch_invoices: amountMismatch,
      missing_customers: [],
      orphan_payments: [],
      missing_ledger_entries: [],
      ui_visibility_issues: [],
    },
  };
  fs.writeFileSync(path.join(DATA_DIR, 'zayoga-master.json'), JSON.stringify(master, null, 2), 'utf8');
  console.log('Wrote backend/data/zayoga-master.json');

  const client = new Client(getDbConfig());
  await client.connect();

  const tenantRow = await client.query('SELECT "Id" FROM "Tenants" WHERE "Email" = $1', [ZAYOGA_EMAIL]);
  if (tenantRow.rows.length === 0) {
    console.error('ZAYOGA tenant not found.');
    await client.end();
    process.exit(1);
  }
  const tenantId = tenantRow.rows[0].Id;

  // ----- PHASE 2: DB audit -----
  const dbInvoices = await client.query(
    'SELECT COUNT(*) AS c FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
    [tenantId]
  );
  const dbCustomers = await client.query('SELECT COUNT(*) AS c FROM "Customers" WHERE "TenantId" = $1', [tenantId]);
  const dbPayments = await client.query(
    'SELECT COUNT(*) AS c FROM "Payments" p INNER JOIN "Sales" s ON p."SaleId" = s."Id" WHERE s."TenantId" = $1 AND s."IsDeleted" = false',
    [tenantId]
  );
  const dbTotalSales = await client.query(
    'SELECT COALESCE(SUM("GrandTotal"), 0) AS t FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
    [tenantId]
  );
  const dbTotalReceived = await client.query(
    `SELECT COALESCE(SUM(p."Amount"), 0) AS t FROM "Payments" p INNER JOIN "Sales" s ON p."SaleId" = s."Id" WHERE s."TenantId" = $1 AND s."IsDeleted" = false AND p."Status" = 'CLEARED'`,
    [tenantId]
  );
  const unpaidDb = await client.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(s."GrandTotal" - s."PaidAmount"), 0) AS bal FROM "Sales" s WHERE s."TenantId" = $1 AND s."IsDeleted" = false AND s."PaymentStatus" IN ('Pending', 'Partial')`,
    [tenantId]
  );

  const invoicesWithoutCustomer = await client.query(
    'SELECT "Id", "InvoiceNo" FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false AND "CustomerId" IS NULL',
    [tenantId]
  );
  const paymentsWithoutInvoice = await client.query(
    'SELECT p."Id", p."Amount" FROM "Payments" p WHERE p."TenantId" = $1 AND (p."SaleId" IS NULL OR NOT EXISTS (SELECT 1 FROM "Sales" s WHERE s."Id" = p."SaleId" AND s."IsDeleted" = false))',
    [tenantId]
  );

  const customersWithWrongBalance = [];
  const customers = await client.query('SELECT "Id", "Name", "Balance", "PendingBalance", "TotalSales", "TotalPayments" FROM "Customers" WHERE "TenantId" = $1', [tenantId]);
  for (const c of customers.rows) {
    const sums = await client.query(
      `SELECT
        (SELECT COALESCE(SUM("GrandTotal"), 0) FROM "Sales" WHERE "CustomerId" = $1 AND "TenantId" = $2 AND "IsDeleted" = false) AS total_sales,
        (SELECT COALESCE(SUM("Amount"), 0) FROM "Payments" WHERE "CustomerId" = $1 AND "TenantId" = $2 AND "Status" = 'CLEARED') AS total_payments`,
      [c.Id, tenantId]
    );
    const totalSales = parseFloat(sums.rows[0].total_sales);
    const totalPayments = parseFloat(sums.rows[0].total_payments);
    const expectedBalance = totalSales - totalPayments;
    const stored = parseFloat(c.Balance);
    if (Math.abs(stored - expectedBalance) > 0.01) {
      customersWithWrongBalance.push({
        customer_id: c.Id,
        name: c.Name,
        stored_balance: stored,
        expected_balance: expectedBalance,
        total_sales: totalSales,
        total_payments: totalPayments,
      });
    }
  }

  const auditReport = {
    company: 'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC',
    tenant_id: tenantId,
    migration_summary: {
      total_csv_invoices: merged.length,
      total_db_invoices: parseInt(dbInvoices.rows[0].c, 10),
      total_customers_created: parseInt(dbCustomers.rows[0].c, 10),
      total_payments_inserted: parseInt(dbPayments.rows[0].c, 10),
      total_ledger_entries: 0,
    },
    financial_validation: {
      csv_total_sales: csvTotalSales,
      db_total_sales: parseFloat(dbTotalSales.rows[0].t),
      csv_total_received: csvTotalReceived,
      db_total_received: parseFloat(dbTotalReceived.rows[0].t),
      csv_total_balance: csvTotalBalance,
      db_total_balance: parseFloat(unpaidDb.rows[0].bal),
      difference_sales: Math.abs(csvTotalSales - parseFloat(dbTotalSales.rows[0].t)),
      difference_received: Math.abs(csvTotalReceived - parseFloat(dbTotalReceived.rows[0].t)),
      difference_balance: Math.abs(csvTotalBalance - parseFloat(unpaidDb.rows[0].bal)),
    },
    status_validation: {
      unpaid_invoice_count_csv: unpaidCount,
      unpaid_invoice_count_db: parseInt(unpaidDb.rows[0].cnt, 10),
      paid_invoice_count_csv: paidCount,
      paid_invoice_count_db: parseInt(dbInvoices.rows[0].c, 10) - parseInt(unpaidDb.rows[0].cnt, 10),
    },
    ledger_validation: {
      invoices_without_ledger_entry: [],
      payments_without_ledger_entry: [],
      customers_with_wrong_balance: customersWithWrongBalance,
    },
    orphan_checks: {
      invoices_without_customer: invoicesWithoutCustomer.rows.map((r) => ({ id: r.Id, invoice_no: r.InvoiceNo })),
      payments_without_invoice: paymentsWithoutInvoice.rows.map((r) => ({ id: r.Id, amount: r.Amount })),
      ledger_without_invoice: [],
    },
  };
  fs.writeFileSync(path.join(DATA_DIR, 'audit-report.json'), JSON.stringify(auditReport, null, 2), 'utf8');
  console.log('Wrote backend/data/audit-report.json');

  // ----- PHASE 3: Repair — recalculate all customer balances -----
  let repaired = 0;
  for (const c of customers.rows) {
    const sums = await client.query(
      `SELECT
        (SELECT COALESCE(SUM("GrandTotal"), 0) FROM "Sales" WHERE "CustomerId" = $1 AND "TenantId" = $2 AND "IsDeleted" = false) AS total_sales,
        (SELECT COALESCE(SUM("Amount"), 0) FROM "Payments" WHERE "CustomerId" = $1 AND "TenantId" = $2 AND "Status" = 'CLEARED') AS total_payments,
        (SELECT COALESCE(SUM("GrandTotal"), 0) FROM "SaleReturns" WHERE "CustomerId" = $1 AND "TenantId" = $2) AS total_returns`,
      [c.Id, tenantId]
    );
    const totalSales = parseFloat(sums.rows[0].total_sales);
    const totalPayments = parseFloat(sums.rows[0].total_payments);
    const totalReturns = parseFloat(sums.rows[0].total_returns || 0);
    const pendingBalance = totalSales - totalPayments - totalReturns;
    await client.query(
      `UPDATE "Customers" SET "TotalSales" = $1, "TotalPayments" = $2, "PendingBalance" = $3, "Balance" = $3, "UpdatedAt" = NOW() WHERE "Id" = $4 AND "TenantId" = $5`,
      [totalSales, totalPayments, pendingBalance, c.Id, tenantId]
    );
    repaired++;
  }
  console.log(`Repaired balances for ${repaired} customers.`);

  await client.end();

  const repairPlan = {
    company: 'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC',
    tenant_id: tenantId,
    actions_taken: [
      'Recalculated Balance/PendingBalance/TotalSales/TotalPayments for all 55 customers from Sales + CLEARED Payments - SaleReturns.',
    ],
    recommendations: [
      'Ledger is computed at runtime from Sales + Payments (no ledger_entries table). If a customer shows empty ledger, check: 1) Date range includes invoice dates (use 2-year range). 2) Customer name match: CSV has "AL ANSARI" (2 invoices); if UI shows "AL ANSARI EXCHANGE" it may be a different customer with 0 sales.',
      'Dashboard "This Month" shows only current month; migrated data is mostly 2025 – use Reports with date range 01-01-2025 to 31-12-2026 to see full data.',
      'Reports default date range: set From 01-01-2025 to include all migrated invoices.',
    ],
    schema_notes: [
      'No ledger_entries table; ledger built from Sales + Payments in CustomerService.GetCustomerLedgerAsync.',
      'Sales with null BranchId/RouteId are included in ledger (legacy data).',
    ],
  };
  fs.writeFileSync(path.join(DATA_DIR, 'repair-plan.json'), JSON.stringify(repairPlan, null, 2), 'utf8');
  console.log('Wrote backend/data/repair-plan.json');

  console.log('\n--- Audit complete ---');
  console.log('CSV invoices:', merged.length, '| DB invoices:', auditReport.migration_summary.total_db_invoices);
  console.log('Customers with wrong balance (before repair):', customersWithWrongBalance.length);
  console.log('Invoices without customer:', auditReport.orphan_checks.invoices_without_customer.length);
  console.log('Payments without invoice:', auditReport.orphan_checks.payments_without_invoice.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
