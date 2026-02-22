/**
 * Ensures ZAYOGA tenant has at least one Branch and one Route.
 * Run this before FIX_PRODUCTION_MIGRATIONS.sql section 5b so the backfill can assign Sales.BranchId/RouteId.
 *
 * Usage: node ensure-zayoga-branch-route.js
 * Uses .env from backend/HexaBill.Api/.env (DATABASE_URL_EXTERNAL)
 *
 * Branch/Route still showing zeros in Reports or Branch detail?
 * 1. Run FIX_PRODUCTION_MIGRATIONS.sql sections 5 and 5b on production (add columns, backfill Sales)
 * 2. Run: node backend/Scripts/ensure-zayoga-branch-route.js
 * 3. Restart API if schema cache was stale, or wait ~5 min for cache expiry
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'HexaBill.Api', '.env') });

const ZAYOGA_EMAIL = 'info@zayoga.ae';

function getDbConfig() {
  const cs = process.env.DATABASE_URL_EXTERNAL || process.env.DATABASE_URL;
  if (cs) {
    const url = new URL(cs);
    return { connectionString: cs, password: url.password || '', ssl: { rejectUnauthorized: true } };
  }
  return {
    host: process.env.PGHOST || process.env.DB_HOST_EXTERNAL || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.PGDATABASE || process.env.DB_NAME || 'hexabill',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
  };
}

async function main() {
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    const tenantRow = await client.query('SELECT "Id" FROM "Tenants" WHERE "Email" = $1 LIMIT 1', [ZAYOGA_EMAIL]);
    if (tenantRow.rows.length === 0) {
      console.log('ZAYOGA tenant not found. Skipping.');
      return;
    }
    const tenantId = tenantRow.rows[0].Id;

    const branchRow = await client.query('SELECT "Id" FROM "Branches" WHERE "TenantId" = $1 ORDER BY "Id" LIMIT 1', [tenantId]);
    let needRoute = true;
    if (branchRow.rows.length > 0) {
      console.log('ZAYOGA already has branch id:', branchRow.rows[0].Id);
      const routeRow = await client.query('SELECT "Id" FROM "Routes" WHERE "BranchId" = $1 ORDER BY "Id" LIMIT 1', [branchRow.rows[0].Id]);
      if (routeRow.rows.length > 0) {
        console.log('ZAYOGA already has route id:', routeRow.rows[0].Id);
        needRoute = false;
      }
    }

    if (branchRow.rows.length === 0) {
      await client.query(
        'INSERT INTO "Branches" ("TenantId", "Name", "Address", "IsActive", "CreatedAt", "UpdatedAt") VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING "Id"',
        [tenantId, 'Main Branch', 'Head Office']
      );
      const ins = await client.query('SELECT "Id" FROM "Branches" WHERE "TenantId" = $1 ORDER BY "Id" DESC LIMIT 1', [tenantId]);
      const branchId = ins.rows[0].Id;
      console.log('Created ZAYOGA branch id:', branchId);

      await client.query(
        'INSERT INTO "Routes" ("BranchId", "TenantId", "Name", "IsActive", "CreatedAt", "UpdatedAt") VALUES ($1, $2, $3, true, NOW(), NOW())',
        [branchId, tenantId, 'Main Route']
      );
      const routeIns = await client.query('SELECT "Id" FROM "Routes" WHERE "BranchId" = $1 ORDER BY "Id" DESC LIMIT 1', [branchId]);
      console.log('Created ZAYOGA route id:', routeIns.rows[0].Id);
    } else if (needRoute) {
      const branchId = branchRow.rows[0].Id;
      await client.query(
        'INSERT INTO "Routes" ("BranchId", "TenantId", "Name", "IsActive", "CreatedAt", "UpdatedAt") VALUES ($1, $2, $3, true, NOW(), NOW())',
        [branchId, tenantId, 'Main Route']
      );
      console.log('Created ZAYOGA route for existing branch', branchId);
    }
    // Run backfill (section 5b) if columns exist
    const colCheck = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Sales' AND column_name='BranchId' LIMIT 1`
    );
    if (colCheck.rows.length > 0) {
      const result = await client.query(`
        WITH tenants AS (
          SELECT DISTINCT "TenantId" FROM "Sales" WHERE "TenantId" IS NOT NULL AND "TenantId" > 0
        ),
        first_branches AS (
          SELECT t."TenantId", (SELECT "Id" FROM "Branches" b WHERE b."TenantId" = t."TenantId" ORDER BY "Id" ASC LIMIT 1) AS branch_id
          FROM tenants t
        ),
        first_routes AS (
          SELECT fb."TenantId", fb.branch_id, (SELECT "Id" FROM "Routes" r WHERE r."BranchId" = fb.branch_id ORDER BY "Id" ASC LIMIT 1) AS route_id
          FROM first_branches fb WHERE fb.branch_id IS NOT NULL
        )
        UPDATE "Sales" s SET "BranchId" = fr.branch_id, "RouteId" = COALESCE(fr.route_id, s."RouteId")
        FROM first_routes fr
        WHERE s."TenantId" = fr."TenantId" AND s."BranchId" IS NULL AND s."IsDeleted" = false
      `);
      console.log('Backfill: updated', result.rowCount, 'Sales rows with BranchId/RouteId');
    } else {
      console.log('Sales.BranchId column not found. Run FIX_PRODUCTION_MIGRATIONS.sql section 5 first.');
    }
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
