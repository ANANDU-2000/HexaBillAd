/**
 * Local Tier 0 bootstrap: provision four tenants + seed minimal mock commerce per tenant.
 * Prerequisites: API on :5000 (Development), Vite optional.
 *
 * Usage: node scripts/tier0-local-bootstrap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.HEXABILL_API || 'http://localhost:5000';
const EDGE_SECRET = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret';
const ADMIN_HOST = 'admin.localhost';
const ADMIN_EMAIL = process.env.HEXABILL_ADMIN_EMAIL || 'admin@hexabill.com';
const ADMIN_PASSWORD = process.env.HEXABILL_ADMIN_PASSWORD || '';
const OWNER_PASSWORD = process.env.HEXABILL_OWNER_PASSWORD || '';

const TENANTS = [
  { slug: 'frozenhub1', email: 'frozenhub1@hexabill.company', label: 'FH1' },
  { slug: 'frozenhub2', email: 'frozenhub2@hexabill.company', label: 'FH2' },
  { slug: 'gulfharvest', email: 'gulfharvest@hexabill.company', label: 'GH' },
  { slug: 'zayoga', email: 'zayoga@hexabill.company', label: 'ZY' },
];

function headers(host, token) {
  // Do not set Host (Node fetch forbids it). Edge secret + original host is the trust path.
  const h = {
    'Content-Type': 'application/json',
    'X-HexaBill-Original-Host': host,
    'X-HexaBill-Edge-Secret': EDGE_SECRET,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function api(host, method, urlPath, body, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: headers(host, token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.Message || text || res.statusText;
    throw new Error(`${method} ${urlPath} @${host} -> ${res.status}: ${msg}`);
  }
  return json;
}

async function login(host, email, password) {
  const json = await api(host, 'POST', '/api/auth/login', { email, password });
  const token = json?.data?.token || json?.Data?.token || json?.data?.Token || json?.Data?.Token;
  if (!token) throw new Error(`No token from login on ${host} for ${email}`);
  return token;
}

async function ensureOwnerPassword(adminToken, tenantId, preferredEmail) {
  const detail = await api(ADMIN_HOST, 'GET', `/api/superadmin/tenant/${tenantId}`, null, adminToken);
  const data = detail?.data || detail?.Data;
  const users = data?.users || data?.Users || [];
  const owner = users.find((u) => (u.email || u.Email || '').toLowerCase() === preferredEmail.toLowerCase())
    || users.find((u) => (u.role || u.Role) === 'Owner')
    || users[0];
  if (!owner) throw new Error(`No users on tenant ${tenantId}`);
  const userId = owner.id ?? owner.Id;
  const ownerEmail = owner.email || owner.Email || preferredEmail;
  await api(
    ADMIN_HOST,
    'PUT',
    `/api/superadmin/tenant/${tenantId}/users/${userId}/reset-password`,
    { newPassword: OWNER_PASSWORD, NewPassword: OWNER_PASSWORD },
    adminToken
  );
  return { userId, ownerEmail };
}

async function seedCommerce(slug, email) {
  const token = await login(`${slug}.localhost`, email, OWNER_PASSWORD);

  // Idempotent-ish: create only when lists are empty.
  const products = await api(`${slug}.localhost`, 'GET', '/api/products?page=1&pageSize=5', null, token);
  const productItems = products?.data?.items || products?.Data?.Items || products?.data || products?.Data || [];
  const productCount = Array.isArray(productItems) ? productItems.length : (productItems?.length ?? 0);

  let productId = Array.isArray(productItems) && productItems[0] ? (productItems[0].id ?? productItems[0].Id) : null;
  if (!productId || productCount === 0) {
    const created = await api(`${slug}.localhost`, 'POST', '/api/products', {
      sku: `T0-${slug.toUpperCase()}-001`,
      nameEn: `${slug} Sample Chicken 1kg`,
      nameAr: 'Ù…Ù†ØªØ¬ ØªØ¬Ø±ÙŠØ¨ÙŠ',
      unitType: 'PCS',
      conversionToBase: 1,
      costPrice: 10,
      sellPrice: 15,
      stockQty: 100,
      reorderLevel: 5,
      isActive: true,
    }, token);
    productId = created?.data?.id || created?.Data?.Id;
  }

  const customers = await api(`${slug}.localhost`, 'GET', '/api/customers?page=1&pageSize=5', null, token);
  const custItems = customers?.data?.items || customers?.Data?.Items || customers?.data || customers?.Data || [];
  if (!Array.isArray(custItems) || custItems.length === 0) {
    await api(`${slug}.localhost`, 'POST', '/api/customers', {
      name: `${slug} Walk-in Cafe`,
      phone: '971500000001',
      creditLimit: 5000,
      customerType: 'Credit',
      paymentTerms: 'Net 30',
    }, token);
  }

  const suppliers = await api(`${slug}.localhost`, 'GET', '/api/suppliers/summary', null, token);
  const supItems = suppliers?.data || suppliers?.Data || [];
  if (!Array.isArray(supItems) || supItems.length === 0) {
    await api(`${slug}.localhost`, 'POST', '/api/suppliers', {
      name: `${slug} Sample Supplier`,
      phone: '971500000002',
      creditLimit: 10000,
      paymentTerms: 'Net 15',
    }, token);
  }

  return { productId, loginOk: true };
}

async function main() {
  console.log(`API=${API}`);
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health?.ok) {
    // Some builds expose /api/health
    const alt = await fetch(`${API}/api/health`).catch(() => null);
    if (!alt?.ok) throw new Error('API not reachable on /health or /api/health â€” start HexaBill.Api first.');
  }

  const adminToken = await login(ADMIN_HOST, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Platform admin login OK');

  const provision = await api(ADMIN_HOST, 'POST', '/api/superadmin/tier0/provision', {}, adminToken);
  const log = provision?.data || provision?.Data || [];
  console.log('Provision log:');
  for (const line of log) console.log(' ', line);

  // Prefer tenant ids from provision log (GetTenants can fail on legacy null Subdomain rows).
  const bySlug = new Map();
  for (const line of log) {
    const m = String(line).match(/tenantId=(\d+)\s+slug=([a-z0-9-]+)/i);
    if (m) bySlug.set(m[2].toLowerCase(), { id: Number(m[1]), subdomain: m[2] });
  }
  try {
    const list = await api(ADMIN_HOST, 'GET', '/api/superadmin/tenant?page=1&pageSize=100', null, adminToken);
    const tenants = list?.data?.items || list?.Data?.Items || list?.data || list?.Data || [];
    for (const t of Array.isArray(tenants) ? tenants : []) {
      const slug = (t.subdomain || t.Subdomain || '').toLowerCase();
      if (slug) bySlug.set(slug, t);
    }
  } catch (err) {
    console.warn('WARN: tenant list failed; using provision log ids only:', err.message);
  }

  const report = { provisioned: log, owners: [], seeds: [] };
  for (const t of TENANTS) {
    const row = bySlug.get(t.slug);
    if (!row) {
      console.warn(`WARN: tenant slug ${t.slug} not in list`);
      continue;
    }
    const id = row.id ?? row.Id;
    const { ownerEmail } = await ensureOwnerPassword(adminToken, id, t.email);
    report.owners.push({ slug: t.slug, tenantId: id, email: ownerEmail, preferredEmail: t.email });
    console.log(`Owner password set for ${t.slug} (login email configured)`);
    const seed = await seedCommerce(t.slug, ownerEmail);
    report.seeds.push({ slug: t.slug, ...seed });
    console.log(`Seeded commerce for ${t.slug}`);
  }

  const outDir = path.join(
    process.env.USERPROFILE || process.env.HOME || '.',
    'OneDrive',
    'Desktop',
    'HexaBill_Backups'
  );
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `tier0-local-bootstrap-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
  console.log('Done. Local owner password for all four tenants:', OWNER_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
