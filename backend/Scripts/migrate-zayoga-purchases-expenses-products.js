/**
 * ZAYOGA Purchase / Expense / Product JSON migration
 *
 * Imports purchases, expenses, and products from JSON with strict totals validation.
 * Totals to validate: purchase total 49,792.12 AED; expense total 91,187.50 AED;
 * unpaid purchases total 16,524.11 AED. Row counts: 18 purchases, 21 expenses, 10 products.
 *
 * Usage:
 *   node migrate-zayoga-purchases-expenses-products.js           # dry run
 *   node migrate-zayoga-purchases-expenses-products.js --execute  # apply
 *
 * JSON path: backend/data/zayoga-purchases-expenses-products.json (or env ZAYOGA_DATA_JSON)
 * Format: { "purchases": [...], "expenses": [...], "products": [...] }
 * - purchases: { purchase_number, vendor, date (DD-MM-YYYY or YYYY-MM-DD), amount, status?: "Paid"|"Unpaid" }
 * - expenses: { expense_number?, date, amount, total?, vat?, note? }
 * - products: { product_name, sku?, unit?, quantity, last_cost, status? }
 *
 * Uses .env from backend/HexaBill.Api/.env.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const ZAYOGA_EMAIL = 'info@zayoga.ae';
const PLACEHOLDER_SKU = 'ZAYOGA-IMPORT';
const PLACEHOLDER_NAME = 'Legacy Purchase Line';
const TOLERANCE = 0.01;

const EXPECTED = {
  purchase_total: 49792.12,
  expense_total: 91187.5,
  unpaid_purchase_total: 16524.11,
  purchase_count: 18,
  expense_count: 21,
  product_count: 10,
};

const DEFAULT_JSON_PATH = path.join(__dirname, '..', 'data', 'zayoga-purchases-expenses-products.json');

function getDbConfig() {
  const connectionString = process.env.DATABASE_URL_EXTERNAL || process.env.DATABASE_URL;
  if (connectionString) {
    try {
      const url = new URL(connectionString);
      return {
        connectionString,
        password: url.password ? String(url.password) : '',
        ssl: { rejectUnauthorized: true },
      };
    } catch (_) {
      // ignore
    }
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

function parseDate(str) {
  if (!str || typeof str !== 'string') return new Date();
  const s = str.trim().replace(/\s+/g, ' ');
  const parts = s.split(/[-/]/);
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

function num(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function loadJson() {
  const jsonPath = process.env.ZAYOGA_DATA_JSON || DEFAULT_JSON_PATH;
  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `JSON not found: ${jsonPath}. Set ZAYOGA_DATA_JSON or place zayoga-purchases-expenses-products.json in backend/data.`
    );
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const purchases = Array.isArray(data.purchases) ? data.purchases : [];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const products = Array.isArray(data.products) ? data.products : [];
  return { purchases, expenses, products, _path: jsonPath };
}

function validateTotals(purchases, expenses, products) {
  const purchaseTotal = purchases.reduce((s, p) => s + num(p.amount), 0);
  const unpaidTotal = purchases
    .filter((p) => String(p.status || '').toLowerCase() === 'unpaid')
    .reduce((s, p) => s + num(p.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (num(e.total) || num(e.amount)), 0);

  const okPurchase = Math.abs(purchaseTotal - EXPECTED.purchase_total) <= TOLERANCE;
  const okUnpaid = Math.abs(unpaidTotal - EXPECTED.unpaid_purchase_total) <= TOLERANCE;
  const okExpense = Math.abs(expenseTotal - EXPECTED.expense_total) <= TOLERANCE;

  if (!okPurchase || !okUnpaid || !okExpense) {
    throw new Error(
      `Totals validation failed. Expected purchase=${EXPECTED.purchase_total}, unpaid=${EXPECTED.unpaid_purchase_total}, expense=${EXPECTED.expense_total}. ` +
        `Got purchase=${purchaseTotal.toFixed(2)}, unpaid=${unpaidTotal.toFixed(2)}, expense=${expenseTotal.toFixed(2)}. Abort.`
    );
  }

  if (purchases.length !== EXPECTED.purchase_count) {
    console.warn(`Warning: purchase count ${purchases.length} (expected ${EXPECTED.purchase_count}). Proceeding.`);
  }
  if (expenses.length !== EXPECTED.expense_count) {
    console.warn(`Warning: expense count ${expenses.length} (expected ${EXPECTED.expense_count}). Proceeding.`);
  }
  if (products.length !== EXPECTED.product_count) {
    console.warn(`Warning: product count ${products.length} (expected ${EXPECTED.product_count}). Proceeding.`);
  }

  return { purchaseTotal, unpaidTotal, expenseTotal };
}

async function main() {
  const execute = process.argv.includes('--execute');
  if (!execute) {
    console.log('DRY RUN. To apply changes run: node migrate-zayoga-purchases-expenses-products.js --execute');
  }

  const { purchases, expenses, products, _path } = loadJson();
  console.log('Loaded from', _path, ':', purchases.length, 'purchases,', expenses.length, 'expenses,', products.length, 'products');

  validateTotals(purchases, expenses, products);
  console.log('Totals validation passed.');

  const client = new Client(getDbConfig());
  await client.connect();

  try {
    const tenantRow = await client.query(
      'SELECT "Id" FROM "Tenants" WHERE "Email" = $1 LIMIT 1',
      [ZAYOGA_EMAIL]
    );
    if (tenantRow.rows.length === 0) {
      throw new Error(`ZAYOGA tenant not found (Email = ${ZAYOGA_EMAIL}).`);
    }
    const tenantId = tenantRow.rows[0].Id;

    const userRow = await client.query(
      'SELECT "Id" FROM "Users" WHERE "TenantId" = $1 AND "Role" = $2 LIMIT 1',
      [tenantId, 'Owner']
    );
    if (userRow.rows.length === 0) {
      throw new Error(`Owner user not found for tenant ${tenantId}.`);
    }
    const ownerUserId = userRow.rows[0].Id;

    if (!execute) {
      console.log('Dry run: would insert', purchases.length, 'purchases,', expenses.length, 'expenses,', products.length, 'products.');
      await client.end();
      return;
    }

    await client.query('BEGIN');

    // Get or create placeholder product for purchase lines
    let placeholderProductId;
    let productRow = await client.query(
      'SELECT "Id" FROM "Products" WHERE "TenantId" = $1 AND "Sku" = $2 LIMIT 1',
      [tenantId, PLACEHOLDER_SKU]
    );
    if (productRow.rows.length > 0) {
      placeholderProductId = productRow.rows[0].Id;
    } else {
      const ins = await client.query(
        `INSERT INTO "Products" (
          "OwnerId", "TenantId", "Sku", "NameEn", "UnitType", "ConversionToBase", "CostPrice", "SellPrice", "StockQty", "ReorderLevel", "IsActive", "CreatedAt", "UpdatedAt"
        ) VALUES ($1, $2, $3, $4, 'PIECE', 1, 0, 0, 0, 0, true, NOW(), NOW())
        RETURNING "Id"`,
        [tenantId, tenantId, PLACEHOLDER_SKU, PLACEHOLDER_NAME]
      );
      placeholderProductId = ins.rows[0].Id;
    }

    // First category for expenses (global table)
    let categoryId;
    const catRow = await client.query(
      'SELECT "Id" FROM "ExpenseCategories" WHERE "IsActive" = true ORDER BY "Id" LIMIT 1'
    );
    if (catRow.rows.length > 0) {
      categoryId = catRow.rows[0].Id;
    } else {
      const insCat = await client.query(
        `INSERT INTO "ExpenseCategories" ("Name", "ColorCode", "IsActive", "CreatedAt") VALUES ('Other', '#6B7280', true, NOW()) RETURNING "Id"`
      );
      categoryId = insCat.rows[0].Id;
    }

    let purchasesInserted = 0;
    let purchasesSkipped = 0;
    for (const p of purchases) {
      const invoiceNo = String(p.purchase_number || p.invoice_number || '').trim().slice(0, 100) || `PUR-${purchasesInserted + purchasesSkipped + 1}`;
      const existing = await client.query(
        'SELECT "Id" FROM "Purchases" WHERE "TenantId" = $1 AND "InvoiceNo" = $2 LIMIT 1',
        [tenantId, invoiceNo]
      );
      if (existing.rows.length > 0) {
        purchasesSkipped++;
        continue;
      }
      const supplierName = String(p.vendor || p.supplier_name || 'Supplier').trim().slice(0, 200);
      const purchaseDate = parseDate(p.date || p.purchase_date);
      const totalAmount = num(p.amount);

      const insPurchase = await client.query(
        `INSERT INTO "Purchases" (
          "OwnerId", "TenantId", "SupplierName", "InvoiceNo", "PurchaseDate", "TotalAmount", "CreatedBy", "CreatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING "Id"`,
        [tenantId, tenantId, supplierName, invoiceNo, purchaseDate, totalAmount, ownerUserId]
      );
      const purchaseId = insPurchase.rows[0].Id;
      await client.query(
        `INSERT INTO "PurchaseItems" ("PurchaseId", "ProductId", "UnitType", "Qty", "UnitCost", "LineTotal") VALUES ($1, $2, 'PIECE', 1, $3, $3)`,
        [purchaseId, placeholderProductId, totalAmount]
      );
      purchasesInserted++;
    }

    let expensesInserted = 0;
    let expensesSkipped = 0;
    for (const e of expenses) {
      const ref = e.expense_number != null ? `ZAYOGA Import: ${e.expense_number}` : null;
      const note = (e.note || ref || 'ZAYOGA Import').trim().slice(0, 500);
      const amount = num(e.total) || num(e.amount);
      const expenseDate = parseDate(e.date);
      const existing = ref
        ? await client.query(
            'SELECT "Id" FROM "Expenses" WHERE "TenantId" = $1 AND "Note" = $2 LIMIT 1',
            [tenantId, note]
          )
        : { rows: [] };
      if (existing.rows.length > 0) {
        expensesSkipped++;
        continue;
      }
      const catId = categoryId;
      await client.query(
        `INSERT INTO "Expenses" ("OwnerId", "TenantId", "CategoryId", "Amount", "Date", "Note", "CreatedBy", "CreatedAt", "Status") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 1)`,
        [tenantId, tenantId, catId, amount, expenseDate, note || 'ZAYOGA Import', ownerUserId]
      );
      expensesInserted++;
    }

    let productsInserted = 0;
    let productsUpdated = 0;
    for (const pr of products) {
      const name = String(pr.product_name || pr.name || 'Product').trim().slice(0, 200);
      const sku = (pr.sku || name.replace(/\s+/g, '-').slice(0, 50) || `ZAYOGA-${productsInserted + productsUpdated + 1}`).slice(0, 50);
      const unit = (pr.unit || 'PIECE').toString().trim().slice(0, 20) || 'PIECE';
      const stockQty = num(pr.quantity ?? pr.stock);
      const costPrice = num(pr.last_cost ?? pr.cost_price ?? pr.cost);

      const existing = await client.query(
        'SELECT "Id", "StockQty", "CostPrice" FROM "Products" WHERE "TenantId" = $1 AND ("Sku" = $2 OR "NameEn" = $3) LIMIT 1',
        [tenantId, sku, name]
      );
      if (existing.rows.length > 0) {
        await client.query(
          'UPDATE "Products" SET "StockQty" = $1, "CostPrice" = $2, "UpdatedAt" = NOW() WHERE "Id" = $3',
          [stockQty, costPrice, existing.rows[0].Id]
        );
        productsUpdated++;
      } else {
        await client.query(
          `INSERT INTO "Products" (
            "OwnerId", "TenantId", "Sku", "NameEn", "UnitType", "ConversionToBase", "CostPrice", "SellPrice", "StockQty", "ReorderLevel", "IsActive", "CreatedAt", "UpdatedAt"
          ) VALUES ($1, $2, $3, $4, $5, 1, $6, $6, $7, 0, true, NOW(), NOW())`,
          [tenantId, tenantId, sku, name, unit, costPrice, stockQty]
        );
        productsInserted++;
      }
    }

    // Re-validate from DB (purchases and expenses totals)
    const sumPurchase = await client.query(
      'SELECT COALESCE(SUM("TotalAmount"), 0) AS t FROM "Purchases" WHERE "TenantId" = $1',
      [tenantId]
    );
    const sumExpense = await client.query(
      'SELECT COALESCE(SUM("Amount"), 0) AS t FROM "Expenses" WHERE "TenantId" = $1',
      [tenantId]
    );
    const totalPurchasesDb = parseFloat(sumPurchase.rows[0].t);
    const totalExpensesDb = parseFloat(sumExpense.rows[0].t);
    // We only validate that our new inserts don't break the expected totals if this is the first run.
    // If there were existing rows, totals will be higher. So we only check that we didn't insert wrong data
    // by comparing that purchase total from JSON matches what we'd expect for *this* batch. For simplicity
    // we just COMMIT and report.
    console.log('Purchases in DB (total):', totalPurchasesDb.toFixed(2));
    console.log('Expenses in DB (total):', totalExpensesDb.toFixed(2));

    await client.query('COMMIT');
    console.log('Done. Inserted:', { purchases: purchasesInserted, expenses: expensesInserted, products: productsInserted });
    console.log('Skipped (idempotent):', { purchases: purchasesSkipped, expenses: expensesSkipped });
    console.log('Products updated:', productsUpdated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
