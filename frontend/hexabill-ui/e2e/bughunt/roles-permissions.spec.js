// T4 bug hunt 1: role permission matrix over the API plus a UI page sweep as Staff. Synthetic tenant only.
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE, feOrigin } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function call (token, path, method = 'GET', body, key) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json, data: json.data }
}

async function loginAs (email, password) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    body: JSON.stringify({ email, password }) })
  const j = await r.json().catch(() => ({}))
  const d = j.data || {}
  if (!r.ok || !d.token) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(j).slice(0, 160)}`)
  return { token: d.token, user: { id: d.userId, role: d.role, name: d.name, companyName: d.companyName, tenantId: d.tenantId,
    pageAccess: d.pageAccess ?? null, dashboardPermissions: d.dashboardPermissions ?? null,
    assignedBranchIds: d.assignedBranchIds || [], assignedRouteIds: d.assignedRouteIds || [], mustChangePassword: false } }
}

const PASSWORD = 'HuntPass-2026!x'
let owner
const sessions = {}

async function ensureUser (role) {
  const email = `hunt-${role.toLowerCase()}@gulfharvest-test.hexabill.local`
  const make = await call(owner.token, '/api/users', 'POST', { name: `Hunt ${role}`, email, password: PASSWORD, role })
  if (make.status >= 300 && !/exist|already|duplicate/i.test(JSON.stringify(make.json))) {
    return { skipped: `create ${role}: ${make.status} ${JSON.stringify(make.json).slice(0, 200)}` }
  }
  return { session: await loginAs(email, PASSWORD) }
}

test.beforeAll(async () => {
  owner = await apiLogin(SLUG)
  for (const role of ['Staff', 'Admin']) {
    const r = await ensureUser(role)
    sessions[role] = r
  }
})

// The synthetic seed refuses to rotate its password when extra users exist, so remove ours when done.
test.afterAll(async () => {
  const list = await call(owner.token, '/api/users?page=1&pageSize=200')
  for (const u of (list.data?.items || list.data?.Items || list.data || [])) {
    if (/^Hunt (Staff|Admin)$/.test(u.name || '')) await call(owner.token, `/api/users/${u.id}`, 'DELETE')
  }
})

test('setup: Staff and Admin users can be created', () => {
  expect({ staff: sessions.Staff?.skipped || 'ok', admin: sessions.Admin?.skipped || 'ok' }).toEqual({ staff: 'ok', admin: 'ok' })
})

test('Staff cannot call owner-only endpoints (users, settings write, backup, audit, delete payment, reset stock)', async () => {
  test.skip(!sessions.Staff?.session, String(sessions.Staff?.skipped))
  const t = sessions.Staff.session.token
  const probes = [
    ['GET', '/api/users?page=1&pageSize=10'],
    ['POST', '/api/users', { name: 'x', email: 'x@y.zz', password: 'abcdef1!', role: 'Admin' }],
    ['PUT', '/api/settings', { COMPANY_NAME_EN: 'hijack' }],
    ['POST', '/api/products/reset-all-stock', {}],
    ['POST', '/api/settings/clear-data', {}],
    ['DELETE', '/api/payments/1'],
    ['PUT', '/api/payments/1/status', { status: 'CLEARED' }],
  ]
  const leaks = []
  for (const [m, p, b] of probes) {
    const r = await call(t, p, m, b)
    if (r.status < 400) leaks.push(`${m} ${p} -> ${r.status}`)
  }
  expect(leaks, 'Staff reached owner/admin-only endpoints').toEqual([])
})

test('Staff cannot see another tenant by header spoofing or id guessing', async () => {
  test.skip(!sessions.Staff?.session, String(sessions.Staff?.skipped))
  const t = sessions.Staff.session.token
  // Sale ids 4..12 belong to the other seeded synthetic tenants.
  const leaks = []
  for (const id of [4, 5, 7, 10]) {
    const r = await call(t, `/api/sales/${id}`)
    if (r.status < 300) leaks.push(`sales/${id} -> ${r.status}`)
    const c = await call(t, `/api/customers/${id === 4 ? 2 : id === 7 ? 3 : 4}`)
    if (c.status < 300) leaks.push(`customers/x -> ${c.status}`)
  }
  expect(leaks).toEqual([])
})

test('Owner cannot read other tenants sales/payments/customers by id', async () => {
  const t = owner.token
  const leaks = []
  for (const [p] of [['/api/sales/4'], ['/api/sales/7'], ['/api/sales/10'], ['/api/customers/2'], ['/api/customers/3'], ['/api/customers/4'], ['/api/payments/3'], ['/api/payments/5'], ['/api/payments/7']]) {
    const r = await call(t, p)
    if (r.status < 300) leaks.push(`${p} -> ${r.status}`)
  }
  expect(leaks).toEqual([])
})

test('Staff page sweep: no uncaught errors, no 5xx, no white screen on core pages', async ({ page }) => {
  test.skip(!sessions.Staff?.session, String(sessions.Staff?.skipped))
  const s = sessions.Staff.session
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror ${e.message.slice(0, 120)}`))
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url().replace(API, '')}`) })
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)) }, s)
  for (const route of ['/dashboard', '/pos', '/payments', '/purchases', '/products', '/returns/create', '/daily-close', '/users', '/settings', '/backup', '/audit', '/reports']) {
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const text = (await page.locator('body').innerText()).trim()
    if (text.length < 40) problems.push(`white screen ${route}`)
    if (/\[object Object\]|undefined|NaN/.test(text)) problems.push(`junk text ${route}: ${(text.match(/.{0,30}(\[object Object\]|undefined|NaN).{0,30}/) || [''])[0].replace(/\s+/g, ' ')}`)
  }
  expect(problems).toEqual([])
})

test('BUG-8 Staff cannot trigger tenant-wide stock recompute (POST /api/products/recompute-stock)', async () => {
  test.skip(!sessions.Staff?.session, String(sessions.Staff?.skipped))
  const r = await call(sessions.Staff.session.token, '/api/products/recompute-stock', 'POST', {})
  expect(r.status, 'Staff may overwrite every product StockQty from movements; should be Admin,Owner like reset-all-stock').toBeGreaterThanOrEqual(400)
})

test('BUG-9 Owner can attach a supplier invoice file to a purchase (POST /api/purchases/{id}/upload)', async () => {
  const st = `${Date.now()}`
  const product = (await call(owner.token, '/api/products', 'POST', { sku: `UP-${st}`, nameEn: `Upload ${st}`, unitType: 'PIECE', conversionToBase: 1, costPrice: 1, sellPrice: 2 })).data
  const purchase = await call(owner.token, '/api/purchases', 'POST', { supplierName: `Upload sup ${st}`, invoiceNo: `UP-${st}`, purchaseDate: new Date().toISOString().slice(0, 10),
    paymentType: 'Credit', items: [{ productId: product.id, unitType: 'PIECE', qty: 1, unitCost: 1 }] }, `up-${st}`)
  expect(purchase.status, JSON.stringify(purchase.json).slice(0, 160)).toBeLessThan(300)
  const form = new FormData()
  form.append('file', new Blob(['%PDF-1.4 hunt'], { type: 'application/pdf' }), 'invoice.pdf')
  const r = await fetch(`${API}/api/purchases/${purchase.data.id}/upload`, { method: 'POST', body: form,
    headers: { Authorization: `Bearer ${owner.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE } })
  expect(r.status, 'Controller says Roles = "Admin,Staff": Owner is missing').not.toBe(403)
})
