/**
 * ZAYOGA Ledger diagnostic (read-only).
 * Phase 1: Resolve tenant, find customer(s), list Sales and InvoiceDate range.
 * Usage: node diagnose-zayoga-ledger.js [customerNameOrId]
 * Example: node diagnose-zayoga-ledger.js "AL SAGAR FISH GRILL"
 *          node diagnose-zayoga-ledger.js 42
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const ZAYOGA_EMAIL = 'info@zayoga.ae';

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
  const customerArg = process.argv[2] || '';
  const client = new Client(getDbConfig());
  await client.connect();

  const out = {
    tenantId: null,
    customers: [],
    sales: [],
    salesSummary: null,
    zayogaSalesDateRange: null,
  };

  try {
    const tenantRow = await client.query('SELECT "Id" FROM "Tenants" WHERE "Email" = $1', [ZAYOGA_EMAIL]);
    if (tenantRow.rows.length === 0) {
      console.log(JSON.stringify({ error: `ZAYOGA tenant not found (Email = ${ZAYOGA_EMAIL})` }, null, 2));
      return;
    }
    const tenantId = tenantRow.rows[0].Id;
    out.tenantId = tenantId;

    let customerIds = [];
    if (customerArg) {
      const idNum = parseInt(customerArg, 10);
      if (!Number.isNaN(idNum)) {
        const r = await client.query(
          'SELECT "Id", "Name", "PendingBalance", "Balance", "TotalSales", "TotalPayments" FROM "Customers" WHERE "TenantId" = $1 AND "Id" = $2',
          [tenantId, idNum]
        );
        if (r.rows.length > 0) {
          out.customers = r.rows.map(row => ({
            Id: row.Id,
            Name: row.Name,
            PendingBalance: parseFloat(row.PendingBalance) || 0,
            Balance: parseFloat(row.Balance) || 0,
            TotalSales: parseFloat(row.TotalSales) || 0,
            TotalPayments: parseFloat(row.TotalPayments) || 0,
          }));
          customerIds = [idNum];
        }
      } else {
        const pattern = customerArg.replace(/\s+/g, '%');
        const r = await client.query(
          `SELECT "Id", "Name", "PendingBalance", "Balance", "TotalSales", "TotalPayments" FROM "Customers" WHERE "TenantId" = $1 AND "Name" ILIKE $2`,
          [tenantId, `%${pattern}%`]
        );
        out.customers = r.rows.map(row => ({
          Id: row.Id,
          Name: row.Name,
          PendingBalance: parseFloat(row.PendingBalance) || 0,
          Balance: parseFloat(row.Balance) || 0,
          TotalSales: parseFloat(row.TotalSales) || 0,
          TotalPayments: parseFloat(row.TotalPayments) || 0,
        }));
        customerIds = r.rows.map(row => row.Id);
      }
    } else {
      const r = await client.query(
        'SELECT "Id", "Name", "PendingBalance", "Balance", "TotalSales", "TotalPayments" FROM "Customers" WHERE "TenantId" = $1 ORDER BY "Name"',
        [tenantId]
      );
      out.customers = r.rows.map(row => ({
        Id: row.Id,
        Name: row.Name,
        PendingBalance: parseFloat(row.PendingBalance) || 0,
        Balance: parseFloat(row.Balance) || 0,
        TotalSales: parseFloat(row.TotalSales) || 0,
        TotalPayments: parseFloat(row.TotalPayments) || 0,
      }));
      customerIds = r.rows.map(row => row.Id);
    }

    if (customerIds.length === 0) {
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    const salesRows = await client.query(
      `SELECT "Id", "InvoiceNo", "InvoiceDate", "GrandTotal", "PaidAmount", "CustomerId",
              "GrandTotal" - "PaidAmount" AS balance
       FROM "Sales"
       WHERE "TenantId" = $1 AND "CustomerId" = ANY($2::int[]) AND "IsDeleted" = false
       ORDER BY "InvoiceDate"`,
      [tenantId, customerIds]
    );
    out.sales = salesRows.rows.map(row => ({
      Id: row.Id,
      InvoiceNo: row.InvoiceNo,
      InvoiceDate: row.InvoiceDate,
      GrandTotal: parseFloat(row.GrandTotal) || 0,
      PaidAmount: parseFloat(row.PaidAmount) || 0,
      balance: parseFloat(row.balance) || 0,
      CustomerId: row.CustomerId,
    }));

    if (out.sales.length > 0) {
      const dates = out.sales.map(s => new Date(s.InvoiceDate).getTime());
      out.salesSummary = {
        count: out.sales.length,
        minInvoiceDate: new Date(Math.min(...dates)).toISOString().split('T')[0],
        maxInvoiceDate: new Date(Math.max(...dates)).toISOString().split('T')[0],
      };
    } else {
      out.salesSummary = { count: 0, minInvoiceDate: null, maxInvoiceDate: null };
    }

    const rangeRow = await client.query(
      `SELECT MIN("InvoiceDate") AS min_dt, MAX("InvoiceDate") AS max_dt, COUNT(*) AS cnt
       FROM "Sales" WHERE "TenantId" = $1 AND "IsDeleted" = false`,
      [tenantId]
    );
    const r = rangeRow.rows[0];
    out.zayogaSalesDateRange = {
      minInvoiceDate: r.min_dt ? new Date(r.min_dt).toISOString().split('T')[0] : null,
      maxInvoiceDate: r.max_dt ? new Date(r.max_dt).toISOString().split('T')[0] : null,
      totalSalesCount: parseInt(r.cnt, 10) || 0,
    };

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
