/**
 * ZAYOGA Controlled Financial Rebuild
 *
 * Reads backend/data/zayoga-241-master.json and rebuilds ONLY ZAYOGA invoices:
 * - Deletes ZAYOGA Sales, SaleItems, Payments (keeps Customers)
 * - Inserts 241 invoices + sale items + payments from JSON
 * - Recalculates customer balances
 * - Validates totals; ROLLBACK if mismatch
 *
 * DO NOT auto-execute. Run with --execute to apply.
 *   node rebuild-zayoga-invoices.js --execute
 *
 * Uses .env from backend/HexaBill.Api/.env (same as repair-zayoga-finance.js).
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const ZAYOGA_EMAIL = 'info@zayoga.ae';
const PLACEHOLDER_SKU = 'ZAYOGA-IMPORT';
const PLACEHOLDER_NAME = 'Legacy Invoice';
const MASTER_JSON_PATH = path.join(__dirname, '..', 'data', 'zayoga-241-master.json');

const TOLERANCE = 0.01;

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

/** Parse "DD-MM-YYYY" or "YYYY-MM-DD" to Date (UTC noon) */
function parseInvoiceDate(str) {
  if (!str || typeof str !== 'string') return new Date();
  const parts = str.trim().split(/[-/]/);
  if (parts.length !== 3) return new Date();
  let day, month, year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Map JSON payment_status to DB: Paid, Unpaid -> Pending, Partial */
function mapPaymentStatus(ps) {
  const s = (ps || '').trim();
  if (s === 'Paid') return 'Paid';
  if (s === 'Partial') return 'Partial';
  return 'Pending';
}

function paymentMode(typeRaw) {
  const t = (typeRaw || '').toLowerCase();
  if (t === 'credit') return 'CREDIT';
  return 'CASH';
}

const FALLBACK_JSON_PATH = path.join(__dirname, '..', 'data', 'zayoga-master.json');

function loadMasterJson() {
  const pathToUse = fs.existsSync(MASTER_JSON_PATH)
    ? MASTER_JSON_PATH
    : fs.existsSync(FALLBACK_JSON_PATH)
      ? FALLBACK_JSON_PATH
      : null;
  if (!pathToUse) {
    throw new Error(
      `Master JSON not found. Place one of these:\n  ${MASTER_JSON_PATH}\n  ${FALLBACK_JSON_PATH}`
    );
  }
  const raw = fs.readFileSync(pathToUse, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.invoices)) {
    throw new Error('Master JSON must have an "invoices" array.');
  }
  const normalized = {
    company: data.company || 'ZAYOGA GENERAL TRADING-SOLE PROPRIETORSHIP LLC',
    invoice_count: data.invoice_count,
    totals: data.totals,
    invoices: [],
  };
  for (const inv of data.invoices) {
    const name = inv.customer_name || (inv.customer && inv.customer.name) || '';
    const amt = Number(inv.amount) || 0;
    const recv = Number(inv.received_amount) != null ? Number(inv.received_amount) : (inv.payments && inv.payments.length ? inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) : 0);
    const bal = Number(inv.balance_amount) != null ? Number(inv.balance_amount) : amt - recv;
    let ps = inv.payment_status || inv.status;
    if (ps === undefined || ps === null || ps === '') {
      if (recv <= 0 && bal >= amt - 0.01) ps = 'Unpaid';
      else if (recv >= amt - 0.01 && bal <= 0.01) ps = 'Paid';
      else ps = 'Partial';
    }
    normalized.invoices.push({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      customer_name: name,
      type: inv.type,
      amount: amt,
      received_amount: recv,
      balance_amount: bal,
      status: inv.status,
      payment_status: String(ps),
    });
  }
  normalized._sourcePath = pathToUse;
  return normalized;
}

function expectedFromMaster(master) {
  if (master.totals && typeof master.totals.total_sales === 'number') {
    const total_balance =
      master.totals.total_balance != null && Number.isFinite(master.totals.total_balance)
        ? master.totals.total_balance
        : (master.totals.total_sales || 0) - (master.totals.total_received || 0);
    return {
      invoice_count: master.invoice_count ?? master.invoices.length,
      total_sales: master.totals.total_sales,
      total_received: master.totals.total_received,
      total_balance: Math.round(total_balance * 100) / 100,
    };
  }
  const invs = master.invoices;
  let total_sales = 0, total_received = 0, total_balance = 0;
  for (const inv of invs) {
    total_sales += Number(inv.amount) || 0;
    total_received += Number(inv.received_amount) || 0;
    total_balance += Number(inv.balance_amount) != null ? Number(inv.balance_amount) : (Number(inv.amount) || 0) - (Number(inv.received_amount) || 0);
  }
  const outBalance = Number.isFinite(total_balance) ? total_balance : total_sales - total_received;
  return {
    invoice_count: invs.length,
    total_sales: Math.round(total_sales * 100) / 100,
    total_received: Math.round(total_received * 100) / 100,
    total_balance: Math.round(outBalance * 100) / 100,
  };
}

async function main() {
  const execute = process.argv.includes('--execute');
  if (!execute) {
    console.log('DRY RUN. To apply changes run: node rebuild-zayoga-invoices.js --execute');
  }

  const master = loadMasterJson();
  const invoices = master.invoices;
  const EXPECTED = expectedFromMaster(master);
  console.log('Loaded', invoices.length, 'invoices from', master._sourcePath || 'master JSON');
  console.log('Expected totals:', EXPECTED);

  const client = new Client(getDbConfig());
  await client.connect();

  const tenantRow = await client.query(
    'SELECT "Id" FROM "Tenants" WHERE "Email" = $1 LIMIT 1',
    [ZAYOGA_EMAIL]
  );
  if (tenantRow.rows.length === 0) {
    await client.end();
    throw new Error(`ZAYOGA tenant not found (Email = ${ZAYOGA_EMAIL}).`);
  }
  const tenantId = tenantRow.rows[0].Id;

  const userRow = await client.query(
    'SELECT "Id" FROM "Users" WHERE "TenantId" = $1 AND "Role" = $2 LIMIT 1',
    [tenantId, 'Owner']
  );
  if (userRow.rows.length === 0) {
    await client.end();
    throw new Error(`Owner user not found for tenant ${tenantId}.`);
  }
  const ownerUserId = userRow.rows[0].Id;

  let productId;
  const productRow = await client.query(
    'SELECT "Id" FROM "Products" WHERE "TenantId" = $1 AND "Sku" = $2 LIMIT 1',
    [tenantId, PLACEHOLDER_SKU]
  );
  if (productRow.rows.length > 0) {
    productId = productRow.rows[0].Id;
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
  }
  console.log('TenantId:', tenantId, 'OwnerUserId:', ownerUserId, 'ProductId:', productId);

  if (!execute) {
    console.log('Exiting (dry run). Use --execute to apply.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  const report = {
    rebuild_status: 'PENDING',
    invoice_inserted: 0,
    payments_created: 0,
    customers_updated: 0,
    total_outstanding: 0,
  };

  try {
    const saleIds = await client.query(
      'SELECT "Id" FROM "Sales" WHERE "TenantId" = $1',
      [tenantId]
    );
    const ids = saleIds.rows.map((r) => r.Id);
    if (ids.length > 0) {
      await client.query('DELETE FROM "Payments" WHERE "TenantId" = $1', [tenantId]);
      await client.query('DELETE FROM "SaleItems" WHERE "SaleId" = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM "Sales" WHERE "TenantId" = $1', [tenantId]);
    }

    const customerCache = new Map();
    for (const inv of invoices) {
      const customerName = (inv.customer_name || (inv.customer && inv.customer.name) || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 200);
      const invoiceNo = (inv.invoice_number || '').trim() || `INV${inv.id || report.invoice_inserted + 1}`;
      const amount = Number(inv.amount) || 0;
      const receivedAmount = Number(inv.received_amount) || 0;
      const balanceAmount = Number(inv.balance_amount) != null ? Number(inv.balance_amount) : amount - receivedAmount;
      const paymentStatus = mapPaymentStatus(inv.payment_status || inv.status);
      const invoiceDate = parseInvoiceDate(inv.invoice_date);
      const lastPaymentDate = receivedAmount > 0 ? invoiceDate : null;

      let customerId = customerCache.get(customerName);
      if (customerId == null) {
        const custRow = await client.query(
          'SELECT "Id" FROM "Customers" WHERE "TenantId" = $1 AND TRIM("Name") = $2 LIMIT 1',
          [tenantId, customerName]
        );
        if (custRow.rows.length > 0) {
          customerId = custRow.rows[0].Id;
        } else {
          const insC = await client.query(
            `INSERT INTO "Customers" (
              "OwnerId", "TenantId", "Name", "CustomerType", "Balance", "CreatedAt", "UpdatedAt"
            ) VALUES ($1, $2, $3, 0, 0, NOW(), NOW())
            RETURNING "Id"`,
            [tenantId, tenantId, customerName]
          );
          customerId = insC.rows[0].Id;
        }
        customerCache.set(customerName, customerId);
      }

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
          invoiceNo,
          invoiceDate,
          customerId,
          amount,
          receivedAmount,
          paymentStatus,
          lastPaymentDate,
          ownerUserId,
        ]
      );
      const saleId = insSale.rows[0].Id;
      report.invoice_inserted++;

      await client.query(
        `INSERT INTO "SaleItems" (
          "SaleId", "ProductId", "UnitType", "Qty", "UnitPrice", "Discount", "VatAmount", "LineTotal"
        ) VALUES ($1, $2, 'PCS', 1, $3, 0, 0, $3)`,
        [saleId, productId, amount]
      );

      if (receivedAmount > 0) {
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
            receivedAmount,
            paymentMode(inv.type),
            invoiceDate,
            ownerUserId,
          ]
        );
        report.payments_created++;
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
      report.customers_updated++;
    }

    const countRow = await client.query(
      'SELECT COUNT(*) AS cnt FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
      [tenantId]
    );
    const sumRow = await client.query(
      `SELECT COALESCE(SUM("GrandTotal"), 0) AS gt, COALESCE(SUM("PaidAmount"), 0) AS pa
       FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false`,
      [tenantId]
    );
    const count = parseInt(countRow.rows[0].cnt, 10);
    const totalSalesDb = parseFloat(sumRow.rows[0].gt);
    const totalPaidDb = parseFloat(sumRow.rows[0].pa);
    const totalOutstandingDb = totalSalesDb - totalPaidDb;

    const countOk = count === EXPECTED.invoice_count;
    const salesOk = Math.abs(totalSalesDb - EXPECTED.total_sales) <= TOLERANCE;
    const receivedOk = Math.abs(totalPaidDb - EXPECTED.total_received) <= TOLERANCE;
    const balanceOk = Math.abs(totalOutstandingDb - EXPECTED.total_balance) <= TOLERANCE;

    if (!countOk || !salesOk || !receivedOk || !balanceOk) {
      await client.query('ROLLBACK');
      console.error('Validation failed. ROLLBACK.');
      console.error({
        count,
        expected_count: EXPECTED.invoice_count,
        total_sales_db: totalSalesDb,
        expected_sales: EXPECTED.total_sales,
        total_received_db: totalPaidDb,
        expected_received: EXPECTED.total_received,
        total_outstanding_db: totalOutstandingDb,
        expected_balance: EXPECTED.total_balance,
      });
      await client.end();
      process.exit(1);
    }

    await client.query('COMMIT');
    report.rebuild_status = 'SUCCESS';
    report.total_outstanding = Math.round(totalOutstandingDb * 100) / 100;
    report.ledger_entries_created = 'N/A (ledger built at runtime from Sales + Payments)';
    report.next_invoice_number = count + 1;

    console.log('\n--- Rebuild report ---');
    console.log(JSON.stringify(report, null, 2));
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    await client.end();
    process.exit(1);
  }
  await client.end();
}

main();
