#!/usr/bin/env node
/**
 * HexaBill smoke script: verifies backend health and optional authenticated routes.
 * Usage:
 *   node scripts/smoke.js [BASE_URL]
 *   BASE_URL defaults to https://hexabill.onrender.com (no trailing slash)
 * Optional env for authenticated checks: SMOKE_EMAIL, SMOKE_PASSWORD
 * Exit: 0 if all checks pass, 1 otherwise.
 */

const baseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://hexabill.onrender.com').replace(/\/$/, '');

async function check(name, url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    const ok = res.ok;
    const status = res.status;
    console.log(ok ? `[OK] ${name} -> ${status}` : `[FAIL] ${name} -> ${status}`);
    if (!ok && res.headers.get('content-type')?.includes('json')) {
      const body = await res.json().catch(() => ({}));
      if (body.message) console.log('     ', body.message);
    }
    return ok;
  } catch (err) {
    console.log(`[FAIL] ${name} -> ${err.message || err}`);
    return false;
  }
}

async function main() {
  console.log(`Smoke check: ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  if (!(await check('GET /health', `${baseUrl}/health`))) failed++;
  else passed++;

  if (!(await check('GET /health/ready (readiness)', `${baseUrl}/health/ready`))) failed++;
  else passed++;

  if (!(await check('GET /api/health', `${baseUrl}/api/health`))) failed++;
  else passed++;

  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (email && password) {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000)
    });
    if (!loginRes.ok) {
      console.log(`[FAIL] POST /api/auth/login -> ${loginRes.status}`);
      failed++;
    } else {
      passed++;
      console.log('[OK] POST /api/auth/login -> 200');
      const data = await loginRes.json().catch(() => ({}));
      const token = data?.data?.token || data?.token;
      if (token) {
        const headers = { Authorization: `Bearer ${token}` };
        const from = new Date();
        from.setMonth(from.getMonth() - 1);
        const to = new Date();
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        if (!(await check('GET /api/settings', `${baseUrl}/api/settings`, { headers }))) failed++;
        else passed++;
        if (!(await check('GET /api/reports/vat-return', `${baseUrl}/api/reports/vat-return?from=${fromStr}&to=${toStr}`, { headers }))) failed++;
        else passed++;
        if (!(await check('GET /api/expenses', `${baseUrl}/api/expenses?pageSize=5`, { headers }))) failed++;
        else passed++;
      }
    }
  } else {
    console.log('(Set SMOKE_EMAIL and SMOKE_PASSWORD to run authenticated checks)\n');
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
