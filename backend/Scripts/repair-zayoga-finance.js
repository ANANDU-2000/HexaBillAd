/**
 * ZAYOGA Production Finance Repair
 *
 * Phases: 1) Sales sync (PaidAmount, PaymentStatus from CLEARED payments)
 *         2) Payment relink (SaleId null -> match by Reference/InvoiceNo)
 *         5) SaleItems check (ensure each Sale has at least one SaleItem)
 *         4) Customer balance recalculation
 *
 * Single transaction; rollback on error. Do NOT auto-execute; run manually.
 * Usage: node repair-zayoga-finance.js [--dry-run]
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const ZAYOGA_EMAIL = 'info@zayoga.ae';
const PLACEHOLDER_SKU = 'ZAYOGA-IMPORT';
const TOLERANCE = 0.01;

const dryRun = process.argv.includes('--dry-run');

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

function paymentStatusFromBalance(grandTotal, actualPaid) {
  const balance = grandTotal - actualPaid;
  if (balance <= TOLERANCE) return 'Paid';
  if (actualPaid > 0) return 'Partial';
  return 'Pending';
}

async function main() {
  if (dryRun) console.log('--- DRY RUN: no changes will be committed ---\n');

  const client = new Client(getDbConfig());
  await client.connect();

  const tenantRow = await client.query('SELECT "Id" FROM "Tenants" WHERE "Email" = $1', [ZAYOGA_EMAIL]);
  if (tenantRow.rows.length === 0) {
    await client.end();
    throw new Error(`ZAYOGA tenant not found (Email = ${ZAYOGA_EMAIL}).`);
  }
  const tenantId = tenantRow.rows[0].Id;
  console.log('ZAYOGA TenantId:', tenantId);

  let productId = null;
  const productRow = await client.query(
    'SELECT "Id" FROM "Products" WHERE "TenantId" = $1 AND "Sku" = $2 LIMIT 1',
    [tenantId, PLACEHOLDER_SKU]
  );
  if (productRow.rows.length > 0) productId = productRow.rows[0].Id;
  if (!productId && !dryRun) {
    await client.end();
    throw new Error(`Placeholder product ${PLACEHOLDER_SKU} not found. Run migration first.`);
  }
  if (productId) console.log('Placeholder product Id:', productId);

  if (!dryRun) await client.query('BEGIN');

  const summary = {
    total_invoices_fixed: 0,
    total_payments_relinked: 0,
    sale_items_added: 0,
    customers_recalculated: 0,
  };

  try {
    // ---------- Phase 1: Sales sync ----------
    const sales = await client.query(
      'SELECT "Id", "InvoiceNo", "GrandTotal", "PaidAmount", "PaymentStatus", "CustomerId" FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false',
      [tenantId]
    );

    for (const sale of sales.rows) {
      const sumRow = await client.query(
        `SELECT COALESCE(SUM("Amount"), 0) AS paid, MAX("PaymentDate") AS last_payment
         FROM "Payments" WHERE "SaleId" = $1 AND "TenantId" = $2 AND "Status" = 'CLEARED'`,
        [sale.Id, tenantId]
      );
      const actualPaid = parseFloat(sumRow.rows[0].paid);
      const lastPaymentDate = sumRow.rows[0].last_payment;
      const currentPaid = parseFloat(sale.PaidAmount);
      const newStatus = paymentStatusFromBalance(parseFloat(sale.GrandTotal), actualPaid);
      const statusMismatch = sale.PaymentStatus !== newStatus;
      const paidMismatch = Math.abs(currentPaid - actualPaid) > TOLERANCE;

      if (paidMismatch || statusMismatch) {
        summary.total_invoices_fixed++;
        if (!dryRun) {
          await client.query(
            `UPDATE "Sales" SET "PaidAmount" = $1, "PaymentStatus" = $2, "LastPaymentDate" = $3 WHERE "Id" = $4 AND "TenantId" = $5`,
            [actualPaid, newStatus, lastPaymentDate, sale.Id, tenantId]
          );
        }
      }
    }
    console.log('Phase 1 (Sales sync): invoices_fixed =', summary.total_invoices_fixed);

    // ---------- Phase 2: Payment relink ----------
    const orphanPayments = await client.query(
      'SELECT "Id", "Reference", "Amount", "CustomerId" FROM "Payments" WHERE "TenantId" = $1 AND "SaleId" IS NULL',
      [tenantId]
    );

    for (const pay of orphanPayments.rows) {
      let invoiceNo = (pay.Reference || '').trim();
      if (!invoiceNo) continue;
      const saleRow = await client.query(
        'SELECT "Id", "CustomerId" FROM "Sales" WHERE "TenantId" = $1 AND "InvoiceNo" = $2 AND "IsDeleted" = false LIMIT 1',
        [tenantId, invoiceNo]
      );
      if (saleRow.rows.length === 0) continue;
      const saleId = saleRow.rows[0].Id;
      const customerId = saleRow.rows[0].CustomerId;
      summary.total_payments_relinked++;
      if (!dryRun) {
        await client.query(
          `UPDATE "Payments" SET "SaleId" = $1, "CustomerId" = $2 WHERE "Id" = $3 AND "TenantId" = $4`,
          [saleId, customerId, pay.Id, tenantId]
        );
      }
    }
    console.log('Phase 2 (Payment relink): payments_relinked =', summary.total_payments_relinked);

    // ---------- Phase 5: SaleItems check ----------
    const salesWithoutItems = await client.query(
      `SELECT s."Id", s."GrandTotal" FROM "Sales" s
       WHERE s."TenantId" = $1 AND s."IsDeleted" = false
       AND NOT EXISTS (SELECT 1 FROM "SaleItems" si WHERE si."SaleId" = s."Id")`,
      [tenantId]
    );

    if (salesWithoutItems.rows.length > 0 && productId) {
      for (const s of salesWithoutItems.rows) {
        summary.sale_items_added++;
        if (!dryRun) {
          await client.query(
            `INSERT INTO "SaleItems" ("SaleId", "ProductId", "UnitType", "Qty", "UnitPrice", "Discount", "VatAmount", "LineTotal")
             VALUES ($1, $2, 'PCS', 1, $3, 0, 0, $3)`,
            [s.Id, productId, parseFloat(s.GrandTotal)]
          );
        }
      }
    }
    console.log('Phase 5 (SaleItems): sale_items_added =', summary.sale_items_added);

    // ---------- Phase 4: Customer balance ----------
    const customers = await client.query('SELECT "Id" FROM "Customers" WHERE "TenantId" = $1', [tenantId]);
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
      summary.customers_recalculated++;
      if (!dryRun) {
        await client.query(
          `UPDATE "Customers" SET "TotalSales" = $1, "TotalPayments" = $2, "PendingBalance" = $3, "Balance" = $3, "UpdatedAt" = NOW() WHERE "Id" = $4 AND "TenantId" = $5`,
          [totalSales, totalPayments, pendingBalance, c.Id, tenantId]
        );
      }
    }
    console.log('Phase 4 (Customer balance): customers_recalculated =', summary.customers_recalculated);

    // ---------- Phase 6: Pending verification (read-only) ----------
    const pendingCheck = await client.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM("GrandTotal" - "PaidAmount"), 0) AS bal
       FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false
       AND "PaymentStatus" IN ('Pending', 'Partial') AND ("GrandTotal" - "PaidAmount") > 0.01`,
      [tenantId]
    );
    const pendingCount = parseInt(pendingCheck.rows[0].cnt, 10);
    const pendingSum = parseFloat(pendingCheck.rows[0].bal);
    console.log('Phase 6 (Verify pending): count =', pendingCount, '| total balance =', pendingSum.toFixed(2));

    if (dryRun) {
      console.log('\n[DRY RUN] No changes committed.');
      await client.end();
      return;
    }

    await client.query('COMMIT');
    console.log('\nTransaction committed.');

    console.log('\n--- Repair summary ---');
    console.log('total_invoices_fixed:', summary.total_invoices_fixed);
    console.log('total_payments_relinked:', summary.total_payments_relinked);
    console.log('sale_items_added:', summary.sale_items_added);
    console.log('customers_recalculated:', summary.customers_recalculated);
    console.log('Done.');
  } catch (err) {
    if (!dryRun) await client.query('ROLLBACK').catch(() => {});
    await client.end();
    throw err;
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
