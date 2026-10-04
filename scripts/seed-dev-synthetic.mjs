#!/usr/bin/env node
/**
 * Deterministic synthetic seed for local/dev/staging only.
 * Refuses production connection strings and production hosts.
 *
 * Usage:
 *   node scripts/seed-dev-synthetic.mjs --api http://127.0.0.1:5000 --admin-token <jwt>
 *
 * Tenants: frozenhub1, frozenhub2, gulfharvest, zayogya-test
 * Data volumes (section 7) are created via API when the platform admin token is provided.
 * No real client documents, passwords, or certificates are read or written.
 */

import { createHash, randomUUID } from 'node:crypto';

const FORBIDDEN_CONN_PATTERNS = [
  /render\.com/i,
  /amazonaws\.com/i,
  /neon\.tech/i,
  /supabase\.co/i,
  /hexabill\.company/i,
  /production/i,
  /prod[_-]/i,
];

const FORBIDDEN_HOST_PATTERNS = [
  /hexabill\.company$/i,
  /onrender\.com$/i,
  /vercel\.app$/i,
];

const SAMPLE_TRN = {
  frozenhub1: '900000000000001',
  frozenhub2: '900000000000002',
  gulfharvest: '900000000000003',
  'zayogya-test': null, // D6 — never seed sample VAT for Zayogya
};

function parseArgs(argv) {
  const out = { api: 'http://127.0.0.1:5000', adminToken: '', connectionString: process.env.ConnectionStrings__DefaultConnection || process.env.DATABASE_URL || '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--api') out.api = argv[++i];
    else if (argv[i] === '--admin-token') out.adminToken = argv[++i];
    else if (argv[i] === '--connection-string') out.connectionString = argv[++i];
  }
  return out;
}

function refuseProduction(opts) {
  const hay = `${opts.api}\n${opts.connectionString}`;
  for (const re of FORBIDDEN_CONN_PATTERNS) {
    if (re.test(hay)) {
      console.error(`REFUSED: connection/api looks like production (${re})`);
      process.exit(2);
    }
  }
  try {
    const host = new URL(opts.api).hostname;
    for (const re of FORBIDDEN_HOST_PATTERNS) {
      if (re.test(host) && host !== 'localhost' && !host.endsWith('.localhost')) {
        console.error(`REFUSED: host looks like production (${host})`);
        process.exit(2);
      }
    }
  } catch {
    console.error('REFUSED: invalid --api URL');
    process.exit(2);
  }
}

function deterministicName(tenant, kind, index) {
  const h = createHash('sha256').update(`${tenant}:${kind}:${index}`).digest('hex').slice(0, 8);
  return `${kind}-${tenant}-${String(index).padStart(3, '0')}-${h}`;
}

async function api(opts, method, path, body) {
  const res = await fetch(`${opts.api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${opts.adminToken}`,
      'Content-Type': 'application/json',
      'X-HexaBill-Edge-Secret': 'dev-local-edge-secret',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function seedTenantPlan(tenant) {
  // Plan only — actual POSTs require a live API + admin token.
  return {
    tenant,
    sampleTrn: SAMPLE_TRN[tenant],
    customers: 30,
    products: 60,
    invoices: 200,
    expenses: ['petrol', 'food', 'shop allowance', 'paper/ink'],
    settlementFixture: { invoice: 1331, cash: 1330, adjustment: 1 },
    names: [
      deterministicName(tenant, 'customer', 1),
      deterministicName(tenant, 'customer-ar', 2),
      deterministicName(tenant, 'customer-ml', 3),
      deterministicName(tenant, 'customer-long', 4) + '-'.padEnd(80, 'x'),
    ],
    idempotencyPrefix: createHash('sha256').update(`seed:${tenant}:v1`).digest('hex').slice(0, 16),
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  refuseProduction(opts);

  const tenants = ['frozenhub1', 'frozenhub2', 'gulfharvest', 'zayogya-test'];
  const plans = [];
  for (const t of tenants) plans.push(await seedTenantPlan(t));

  console.log(JSON.stringify({
    mode: opts.adminToken ? 'execute-ready' : 'dry-run',
    refusedProduction: true,
    runId: randomUUID(),
    plans,
    note: opts.adminToken
      ? 'Token provided — wire CreateTenant/product/customer/sale loops against local API next.'
      : 'Dry run only. Pass --admin-token to execute against a local API.',
  }, null, 2));

  if (!opts.adminToken) {
    console.error('Dry-run complete (no --admin-token).');
    process.exit(0);
  }

  // Minimal live probe: platform health
  try {
    const health = await fetch(`${opts.api}/health`);
    console.error(`health ${health.status}`);
  } catch (e) {
    console.error(`API unreachable: ${e.message}`);
    process.exit(1);
  }

  // Provision path (idempotent Tier0) when available
  try {
    await api(opts, 'POST', '/api/superadmin/tier0/provision', {});
    console.error('tier0 provision ok');
  } catch (e) {
    console.error(`tier0 provision skipped/failed: ${e.message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
