/**
 * Lightweight shell route reachability via fetch of Vite HTML + API auth checks.
 * Browser screenshots are captured separately in Cursor browser.
 */
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.HEXABILL_FE || 'http://127.0.0.1:5174';
const API = process.env.HEXABILL_API || 'http://localhost:5000';
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret';
const PASS = process.env.HEXABILL_OWNER_PASSWORD || '';
const OUT = process.env.HEXABILL_EVIDENCE_DIR
  || path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop', 'HexaBill_Backups', 'tier0-shell');

const CORE = ['/dashboard', '/pos', '/customers', '/products', '/purchases', '/ledger', '/reports', '/settings'];
const EXTRA = [
  '/suppliers', '/expenses', '/returns/create', '/vat-return', '/daily-close', '/backup',
  '/users', '/profile', '/quotations', '/delivery-notes', '/pricelist', '/stock-adjustments',
  '/branches', '/routes', '/audit', '/help', '/more', '/agreements', '/recurring-invoices',
  '/salary-certificates', '/worksheet', '/billing-history', '/feedback', '/sales-ledger',
  '/reports/outstanding',
];

const TENANTS = [
  { slug: 'frozenhub1', email: 'frozenhub1@hexabill.company' },
  { slug: 'frozenhub2', email: 'frozenhub2@hexabill.company' },
  { slug: 'gulfharvest', email: 'gulfharvest@hexabill.company' },
  { slug: 'zayoga', email: 'zayoga@hexabill.company' },
];

function headers(host, token) {
  const h = {
    'Content-Type': 'application/json',
    'X-HexaBill-Original-Host': host,
    'X-HexaBill-Edge-Secret': EDGE,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function login(slug, email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: headers(`${slug}.localhost`),
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json();
  const token = json?.data?.token || json?.Data?.token;
  if (!res.ok || !token) throw new Error(`login failed ${slug}: ${res.status}`);
  return token;
}

async function checkHtml(slug, route) {
  // Prefer IPv4 loopback â€” *.localhost often resolves to ::1 where another Vite app may bind.
  const url = `http://127.0.0.1:5174${route}`;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { Host: `${slug}.localhost:5174` },
    });
    const text = await res.text();
    const ok = res.ok && (text.includes('HexaBill') || text.includes('root') || text.includes('vite') || text.includes('id="root"'));
    return { route, pass: ok, status: res.status, bytes: text.length };
  } catch (e) {
    return { route, pass: false, status: 0, error: e.message };
  }
}

async function checkSettings(slug, token) {
  const res = await fetch(`${API}/api/settings`, { headers: headers(`${slug}.localhost`, token) });
  const json = await res.json();
  const blob = JSON.stringify(json);
  return {
    pass: res.ok,
    hasName: blob.toLowerCase().includes('frozen') || blob.toLowerCase().includes('gulf') || blob.toLowerCase().includes('zay'),
    trnSample: /90000000000000\d/.test(blob),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { at: new Date().toISOString(), fe: FE, tenants: {} };
  for (const t of TENANTS) {
    const token = await login(t.slug, t.email);
    const settings = await checkSettings(t.slug, token);
    const core = [];
    for (const r of CORE) core.push(await checkHtml(t.slug, r));
    const extra = [];
    for (const r of EXTRA) extra.push(await checkHtml(t.slug, r));
    report.tenants[t.slug] = {
      login: true,
      settings,
      core,
      extra,
      corePass: core.every((x) => x.pass),
      extraPassCount: extra.filter((x) => x.pass).length,
      extraTotal: extra.length,
    };
    console.log(t.slug, 'core', report.tenants[t.slug].corePass ? 'PASS' : 'FAIL',
      'extra', `${report.tenants[t.slug].extraPassCount}/${report.tenants[t.slug].extraTotal}`,
      'settings', settings);
  }
  const file = path.join(OUT, 'shell-route-results.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('Wrote', file);
}

main().catch((e) => { console.error(e); process.exit(1); });
