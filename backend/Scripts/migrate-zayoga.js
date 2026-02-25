/**
 * ZAYOGA Invoice CSV Migration Script
 *
 * Migrates invoice data from 3 CSVs into HexaBill PostgreSQL (Tenants, Customers, Sales, SaleItems, Payments).
 * Run after ZAYOGA tenant exists (CREATE_ZAYOGA_TENANT.sql). Do NOT create the tenant; script looks up by Email.
 *
 * Usage:
 *   Set DATABASE_URL or PGHOST, PGUSER, PGPASSWORD, PGDATABASE. Then:
 *   node backend/scripts/migrate-zayoga.js
 *
 * Config:
 *   CSV_FOLDER: path to folder containing the 3 CSVs (default: ZAYOGA GENERAL TRADING-SOLE PROPERIETORSHIP LLC, relative to repo root)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from backend/HexaBill.Api (for DATABASE_URL_EXTERNAL / DATABASE_URL)
require('dotenv').config({
  path: path.join(__dirname, '..', 'HexaBill.Api', '.env'),
});

const TOLERANCE = 0.01;
const ZAYOGA_EMAIL = 'info@zayoga.ae';
const PLACEHOLDER_SKU = 'ZAYOGA-IMPORT';
const PLACEHOLDER_NAME = 'Legacy Invoice';

const CSV_FOLDER =
  process.env.CSV_FOLDER ||
  path.join(
    path.dirname(path.dirname(__dirname)),
    'ZAYOGA GENERAL TRADING-SOLE PROPERIETORSHIP LLC'
  );

const CSV_FILES = [
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC -1 Invoice.csv',
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC 11- Invoice.csv',
  'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC d - Invoice.csv',
];

function getDbConfig() {
  // Prefer external URL when running from local PC (e.g. to Render Postgres)
  const connectionString =
    process.env.DATABASE_URL_EXTERNAL ||
    process.env.DATABASE_URL;
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
    host: process.env.PGHOST || process.env.DB_HOST_EXTERNAL || process.env.DB_HOST_INTERNAL || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: password !== undefined && password !== null ? String(password) : '',
    database: process.env.PGDATABASE || process.env.DB_NAME || 'hexabill',
  };
}

function parseDecimal(s) {
  if (s == null || s === '') return 0;
  const t = String(s).trim().replace(/,/g, '');
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeName(name) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

function parseDate(parts) {
  // parts: array of strings like "26-", "01-", "2026" (day, month, year)
  let day = null,
    month = null,
    year = null;
  for (const p of parts) {
    const t = (p || '').trim();
    if (!t) continue;
    if (/^\d{4}$/.test(t)) {
      year = parseInt(t, 10);
    } else if (/^\d{1,2}-$/.test(t)) {
      const num = parseInt(t, 10);
      if (day == null) day = num;
      else if (month == null) month = num;
    }
  }
  if (year == null) return null;
  const d = day != null ? day : 1;
  const m = month != null ? month : 1;
  const date = new Date(Date.UTC(year, m - 1, d, 0, 0, 0, 0));
  if (isNaN(date.getTime())) return null;
  return date;
}

function isDataHeaderRow(cells) {
  const c0 = (cells[0] || '').trim();
  const c1 = (cells[1] || '').trim().toLowerCase();
  const c2 = (cells[2] || '').trim().toUpperCase();
  return (
    (c0 === '#' || c0 === '') &&
    (c1 === 'type' || c2 === 'TYPE') &&
    (c2 === 'SALES NO' || (cells[2] || '').trim().toUpperCase().includes('SALES'))
  );
}

function isMainDataRow(cells) {
  const c0 = (cells[0] || '').trim();
  return /^\d+$/.test(c0);
}

function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).map((line) => line.split(','));
  const records = [];
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 13) continue;
    if (isDataHeaderRow(row)) {
      headerIndex = i;
      continue;
    }
    if (headerIndex < 0) continue;
    if (!isMainDataRow(row)) continue;

    const nameParts = [(row[4] || '').trim()];
    const dateParts = [(row[8] || '').trim()];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (next.length < 9) {
        j++;
        continue;
      }
      const next0 = (next[0] || '').trim();
      if (/^\d+$/.test(next0)) break;
      const part4 = (next[4] || '').trim();
      const part8 = (next[8] || '').trim();
      if (part4) nameParts.push(part4);
      if (part8) dateParts.push(part8);
      j++;
    }

    const customerName = normalizeName(nameParts.join(' '));
    const typeRaw = (row[1] || '').trim();
    const invoiceNo = (row[2] || '').trim();
    const statusRaw = (row[9] || '').trim();
    const amount = parseDecimal(row[10]);
    const receivedAmount = parseDecimal(row[11]);
    const balanceAmount = parseDecimal(row[12]);
    const invoiceDate = parseDate(dateParts);

    if (!invoiceNo) continue;

    records.push({
      type: typeRaw,
      invoice_no: invoiceNo,
      customer_name: customerName || 'Unknown',
      invoice_date: invoiceDate,
      status: statusRaw,
      amount,
      received_amount: receivedAmount,
      balance_amount: balanceAmount,
    });
  }
  return records;
}

function mergeAndDedupe(allRecords) {
  const byInvoice = new Map();
  for (const r of allRecords) {
    const key = (r.invoice_no || '').trim();
    if (!key) continue;
    if (!byInvoice.has(key)) byInvoice.set(key, r);
  }
  return Array.from(byInvoice.values());
}

function validateRecord(r, index) {
  const sum = r.received_amount + r.balance_amount;
  const diff = Math.abs(r.amount - sum);
  if (diff > TOLERANCE) {
    console.warn(
      `[WARN] Row ${index}: amount (${r.amount}) != received (${r.received_amount}) + balance (${r.balance_amount}); diff=${diff}. Continuing.`
    );
  }
  if (r.amount < 0) {
    throw new Error(`Row ${index}: negative amount ${r.amount}. Aborting.`);
  }
  if (!r.invoice_date && r.amount !== 0) {
    console.warn(`[WARN] Row ${index}: missing/invalid date for invoice ${r.invoice_no}. Using today.`);
    r.invoice_date = new Date();
  }
  if (!r.invoice_date) r.invoice_date = new Date();
}

function paymentStatus(receivedAmount, balanceAmount, statusRaw) {
  const paid = (statusRaw || '').toLowerCase() === 'paid';
  if (paid && balanceAmount <= 0) return 'Paid';
  if (receivedAmount > 0 && balanceAmount > 0) return 'Partial';
  return 'Pending';
}

function paymentMode(typeRaw) {
  const t = (typeRaw || '').toLowerCase();
  if (t === 'cash') return 'CASH';
  if (t === 'credit') return 'CREDIT';
  return 'CASH';
}

async function main() {
  console.log('ZAYOGA CSV migration started.');
  console.log('CSV folder:', CSV_FOLDER);

  const allRecords = [];
  for (const file of CSV_FILES) {
    const fullPath = path.join(CSV_FOLDER, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[WARN] File not found: ${fullPath}. Skipping.`);
      continue;
    }
    const records = parseCsvFile(fullPath);
    console.log(`Parsed ${records.length} records from ${file}`);
    allRecords.push(...records);
  }

  const merged = mergeAndDedupe(allRecords);
  console.log(`Merged and deduped: ${merged.length} unique invoices.`);

  for (let i = 0; i < merged.length; i++) {
    validateRecord(merged[i], i);
  }

  const client = new Client(getDbConfig());
  await client.connect();

  let tenantId, ownerUserId;
  const tenantRow = await client.query(
    'SELECT "Id" FROM "Tenants" WHERE "Email" = $1 LIMIT 1',
    [ZAYOGA_EMAIL]
  );
  if (tenantRow.rows.length === 0) {
    await client.end();
    throw new Error(
      `ZAYOGA tenant not found (Email = ${ZAYOGA_EMAIL}). Run CREATE_ZAYOGA_TENANT.sql first.`
    );
  }
  tenantId = tenantRow.rows[0].Id;

  const userRow = await client.query(
    'SELECT "Id" FROM "Users" WHERE "TenantId" = $1 AND "Role" = $2 LIMIT 1',
    [tenantId, 'Owner']
  );
  if (userRow.rows.length === 0) {
    await client.end();
    throw new Error(
      `Owner user not found for tenant ${tenantId}. Run CREATE_ZAYOGA_TENANT.sql first.`
    );
  }
  ownerUserId = userRow.rows[0].Id;
  console.log(`Resolved TenantId=${tenantId}, OwnerUserId=${ownerUserId}.`);

  let productId;
  const productRow = await client.query(
    'SELECT "Id" FROM "Products" WHERE "TenantId" = $1 AND "Sku" = $2 LIMIT 1',
    [tenantId, PLACEHOLDER_SKU]
  );
  if (productRow.rows.length > 0) {
    productId = productRow.rows[0].Id;
    console.log(`Using existing placeholder product Id=${productId}.`);
  } else {
    const ins = await client.query(
      `INSERT INTO "Products" (
        "OwnerId", "TenantId", "Sku", "NameEn", "NameAr", "UnitType", "ConversionToBase",
        "CostPrice", "SellPrice", "StockQty", "ReorderLevel", "CreatedAt", "UpdatedAt"
      ) VALUES ($1, $2, $3, $4, NULL, 'PCS', 1, 0, 0, 0, 0, NOW(), NOW())
      RETURNING "Id"`,
      [tenantId, tenantId, PLACEHOLDER_SKU, PLACEHOLDER_NAME]
    );
    productId = ins.rows[0].Id;
    console.log(`Created placeholder product Id=${productId}.`);
  }

  const customerCache = new Map();
  let totalInvoicesInserted = 0;
  let totalCustomersInserted = 0;
  let totalPaymentsInserted = 0;
  let totalUnpaidInvoices = 0;
  let totalOutstandingBalance = 0;
  let totalRevenue = 0;
  let duplicateSkipped = 0;

  await client.query('BEGIN');
  try {
    for (const r of merged) {
      let customerId = customerCache.get(r.customer_name);
      if (customerId == null) {
        const custRow = await client.query(
          'SELECT "Id" FROM "Customers" WHERE "TenantId" = $1 AND TRIM("Name") = $2 LIMIT 1',
          [tenantId, r.customer_name]
        );
        if (custRow.rows.length > 0) {
          customerId = custRow.rows[0].Id;
        } else {
          const insC = await client.query(
            `INSERT INTO "Customers" (
              "OwnerId", "TenantId", "Name", "CustomerType", "Balance", "CreatedAt", "UpdatedAt"
            ) VALUES ($1, $2, $3, 0, 0, NOW(), NOW())
            RETURNING "Id"`,
            [tenantId, tenantId, r.customer_name]
          );
          customerId = insC.rows[0].Id;
          totalCustomersInserted++;
        }
        customerCache.set(r.customer_name, customerId);
      }

      const existingSale = await client.query(
        'SELECT "Id" FROM "Sales" WHERE "TenantId" = $1 AND "InvoiceNo" = $2 AND "IsDeleted" = false LIMIT 1',
        [tenantId, r.invoice_no]
      );
      if (existingSale.rows.length > 0) {
        duplicateSkipped++;
        continue;
      }

      const payStatus = paymentStatus(r.received_amount, r.balance_amount, r.status);
      const invoiceDate = r.invoice_date || new Date();
      const lastPaymentDate = r.received_amount > 0 ? invoiceDate : null;

      const insSale = await client.query(
        `INSERT INTO "Sales" (
          "OwnerId", "TenantId", "InvoiceNo", "InvoiceDate", "CustomerId",
          "Subtotal", "VatTotal", "Discount", "GrandTotal", "TotalAmount", "PaidAmount",
          "PaymentStatus", "LastPaymentDate", "CreatedBy", "CreatedAt", "IsFinalized", "IsDeleted"
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $6, $6, $7, $8, $9, $10, NOW(), true, false)
        RETURNING "Id"`,
        [
          tenantId,
          tenantId,
          r.invoice_no,
          invoiceDate,
          customerId,
          r.amount,
          r.received_amount,
          payStatus,
          lastPaymentDate,
          ownerUserId,
        ]
      );
      const saleId = insSale.rows[0].Id;
      totalInvoicesInserted++;
      totalRevenue += r.amount;
      if (payStatus === 'Pending' || payStatus === 'Partial') {
        totalUnpaidInvoices++;
        totalOutstandingBalance += r.balance_amount;
      }

      await client.query(
        `INSERT INTO "SaleItems" (
          "SaleId", "ProductId", "UnitType", "Qty", "UnitPrice", "Discount", "VatAmount", "LineTotal"
        ) VALUES ($1, $2, 'PCS', 1, $3, 0, 0, $3)`,
        [saleId, productId, r.amount]
      );

      if (r.received_amount > 0) {
        await client.query(
          `INSERT INTO "Payments" (
            "OwnerId", "TenantId", "SaleId", "CustomerId", "Amount", "Mode", "Status",
            "PaymentDate", "CreatedBy", "CreatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, 'CLEARED', $7, $8, NOW())`,
          [
            tenantId,
            tenantId,
            saleId,
            customerId,
            r.received_amount,
            paymentMode(r.type),
            invoiceDate,
            ownerUserId,
          ]
        );
        totalPaymentsInserted++;
      }
    }

    const customerIds = Array.from(new Set(customerCache.values()));
    for (const cid of customerIds) {
      const salesSum = await client.query(
        `SELECT COALESCE(SUM("GrandTotal"), 0) AS t FROM "Sales" WHERE "CustomerId" = $1 AND "IsDeleted" = false`,
        [cid]
      );
      const paySum = await client.query(
        `SELECT COALESCE(SUM("Amount"), 0) AS t FROM "Payments" WHERE "CustomerId" = $1 AND "Status" = 'CLEARED'`,
        [cid]
      );
      const totalSales = parseFloat(salesSum.rows[0].t);
      const totalPayments = parseFloat(paySum.rows[0].t);
      const balance = totalSales - totalPayments;
      await client.query(
        `UPDATE "Customers" SET "TotalSales" = $1, "TotalPayments" = $2, "PendingBalance" = $3, "Balance" = $3, "UpdatedAt" = NOW() WHERE "Id" = $4`,
        [totalSales, totalPayments, balance, cid]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    await client.end();
    throw e;
  }

  await client.end();

  console.log('\n--- Migration summary ---');
  console.log('total_invoices_inserted:', totalInvoicesInserted);
  console.log('total_customers_inserted:', totalCustomersInserted);
  console.log('total_payments_inserted:', totalPaymentsInserted);
  console.log('total_unpaid_invoices:', totalUnpaidInvoices);
  console.log('total_outstanding_balance:', totalOutstandingBalance.toFixed(2));
  console.log('total_revenue:', totalRevenue.toFixed(2));
  console.log('duplicate_invoices_skipped:', duplicateSkipped);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/*
VERIFICATION (after migration) — replace <zayoga_tenant_id> with actual Tenant Id:

-- Invoice count
SELECT COUNT(*) AS invoice_count
FROM "Sales"
WHERE "TenantId" = <zayoga_tenant_id> AND "IsDeleted" = false;

-- Customer count
SELECT COUNT(*) AS customer_count
FROM "Customers"
WHERE "TenantId" = <zayoga_tenant_id>;

-- Unpaid count and outstanding balance
SELECT COUNT(*) AS unpaid_count,
       COALESCE(SUM("GrandTotal" - "PaidAmount"), 0) AS outstanding_balance
FROM "Sales"
WHERE "TenantId" = <zayoga_tenant_id> AND "IsDeleted" = false
  AND "PaymentStatus" IN ('Pending', 'Partial');

-- Total revenue (sum of all invoice amounts)
SELECT COALESCE(SUM("GrandTotal"), 0) AS total_revenue
FROM "Sales"
WHERE "TenantId" = <zayoga_tenant_id> AND "IsDeleted" = false;
*/
