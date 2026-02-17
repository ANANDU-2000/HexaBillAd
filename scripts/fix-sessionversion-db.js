#!/usr/bin/env node
/**
 * One-time fix: Add SessionVersion to Users table (fixes 42703 login error)
 * Run: node scripts/fix-sessionversion-db.js
 * Requires: npm install pg (or use npx)
 */
const { Client } = require('pg');

const conn = process.env.DATABASE_URL_EXTERNAL || process.env.DATABASE_URL;
if (!conn) {
  console.error('Set DATABASE_URL or DATABASE_URL_EXTERNAL (from backend/.env)');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SessionVersion" integer NOT NULL DEFAULT 0');
    await client.query('ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "PaymentTerms" character varying(100) NULL');
    console.log('OK: SessionVersion and PaymentTerms columns added.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
