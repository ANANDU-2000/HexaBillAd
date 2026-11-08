// T4 hunt 2: Driver (Staff assigned to one route): route list, visit status, arrival; scope and edge inputs.
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })
const H = { 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }
const PASSWORD = 'HuntDrv-2026!x'
let owner; let driver; let branchId; let routeA; let routeB; let custA; let custB; const made = []

async function call (token, path, method = 'GET', body) {
  const r = await fetch(`${API}${path}`, { method, headers: { ...H, Authorization: `Bearer ${token}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json, data: json.data }
}
const is4xx = (r, label) => { expect(r.status, `${label} ${JSON.stringify(r.json).slice(0, 160)}`).toBeGreaterThanOrEqual(400); expect(r.status, label).toBeLessThan(500) }
const today = () => new Date().toISOString().slice(0, 10)

test.beforeAll(async () => {
  owner = await apiLogin(SLUG)
  const o = (p, m, b) => call(owner.token, p, m, b)
  const st = `${Date.now()}`
  const br = await o('/api/branches')
  branchId = (br.data?.items ?? br.data ?? [])[0]?.id
  if (!branchId) branchId = (await o('/api/branches', 'POST', { name: `Hunt Branch ${st}` })).data.id
  routeA = (await o('/api/routes', 'POST', { branchId, name: `Hunt Route A ${st}` })).data.id
  routeB = (await o('/api/routes', 'POST', { branchId, name: `Hunt Route B ${st}` })).data.id
  let n = 0
  const mk = async (name, routeId) => (await o('/api/customers', 'POST', { name, phone: `05${++n}${st.slice(-7)}`, branchId, routeId, address: 'Hunt street', mainLatitude: 25.2, mainLongitude: 55.27 })).data
  custA = await mk(`Hunt A ${st}`, routeA)
  custB = await mk(`Hunt B ${st}`, routeB)
  const email = `hunt-driver-${st}@gulfharvest-test.hexabill.local`
  const u = await o('/api/users', 'POST', { name: 'Hunt Driver', email, password: PASSWORD, role: 'Staff' })
  if (u.status >= 300) throw new Error(`create driver: ${JSON.stringify(u.json).slice(0, 200)}`)
  made.push(u.data?.userId ?? u.data?.id ?? u.data?.Id)
  await o(`/api/routes/${routeA}/staff/${made[0]}`, 'POST')
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: PASSWORD }) })
  driver = { token: (await r.json()).data.token }
})

// The seed refuses password rotation when extra users exist, so clean up.
test.afterAll(async () => {
  const o = (p, m) => call(owner.token, p, m)
  for (const c of [custA, custB]) if (c?.id) await o(`/api/customers/${c.id}`, 'DELETE')
  for (const r of [routeA, routeB]) if (r) await o(`/api/routes/${r}`, 'DELETE')
  for (const id of made) if (id) await o(`/api/users/${id}`, 'DELETE')
})

const visit = (routeId, customerId, over = {}) => call(driver.token, `/api/routes/${routeId}/visits`, 'POST', { customerId, visitDate: today(), status: 'Arrived', ...over })

test('driver sees only the assigned route in the route list', async () => {
  const r = await call(driver.token, '/api/routes')
  const ids = (r.data?.items ?? r.data ?? []).map((x) => x.id)
  expect(ids).toContain(routeA)
  expect(ids, 'driver sees a route not assigned to them').not.toContain(routeB)
})

test('BUG-38 driver cannot read visits, stops or the customer record of an unassigned route (GET /api/customers/{id} returns another route customer)', async () => {
  const leaks = []
  for (const [m, p, b] of [
    ['GET', `/api/routes/${routeB}/visits`], ['GET', `/api/routes/${routeB}`], ['GET', `/api/routes/${routeB}/stops-map`],
    ['POST', `/api/routes/${routeB}/visits`, { customerId: custB.id, visitDate: today(), status: 'Arrived' }],
    ['GET', `/api/customers/${custB.id}`],
  ]) {
    const r = await call(driver.token, p, m, b)
    if (r.status < 300) leaks.push(`${m} ${p} -> ${r.status}`)
  }
  expect(leaks).toEqual([])
})

test('driver cannot log a visit for a customer that belongs to another route (using their own route id)', async () => {
  const r = await visit(routeA, custB.id)
  expect(r.status, JSON.stringify(r.json).slice(0, 160)).toBeGreaterThanOrEqual(400)
})

test('driver visit: arrival on own route works and is repeatable without 5xx; Failed/Skipped need a note', async () => {
  const a1 = await visit(routeA, custA.id)
  expect(a1.status, JSON.stringify(a1.json).slice(0, 200)).toBeLessThan(300)
  const a2 = await visit(routeA, custA.id)
  expect(a2.status).toBeLessThan(500)
  is4xx(await visit(routeA, custA.id, { status: 'Failed' }), 'Failed without note')
  is4xx(await visit(routeA, custA.id, { status: 'Bogus' }), 'unknown status')
})

test('BUG-40 visit with latitude 999 / longitude -500 is refused (would corrupt the route map)', async () => {
  const a = await visit(routeA, custA.id, { latitude: 999, longitude: 55 })
  const b = await visit(routeA, custA.id, { latitude: 25, longitude: -500 })
  expect({ lat999: a.status >= 400, lng500: b.status >= 400 }).toEqual({ lat999: true, lng500: true })
})
test('BUG-41 route visit with negative or 1e12 collected amount is refused', async () => {
  is4xx(await visit(routeA, custA.id, { status: 'PaymentCollected', paymentCollected: -50 }), 'negative collected')
  is4xx(await visit(routeA, custA.id, { status: 'PaymentCollected', paymentCollected: 1e12 }), 'collected 1e12')
})
test('visit with a 5000-char note is refused with 4xx', async () => {
  is4xx(await visit(routeA, custA.id, { notes: 'n'.repeat(5000) }), '5000-char note')
})

test('driver cannot move the saved shop pin (updateSavedLocation) or reorder stops', async () => {
  const r = await visit(routeA, custA.id, { updateSavedLocation: true, latitude: 24.1, longitude: 54.1 })
  expect(r.status, 'driver changed the customer pin').toBeGreaterThanOrEqual(400)
  const o = await call(driver.token, `/api/routes/${routeA}/stops/order`, 'PUT', { customerIds: [custA.id] })
  expect(o.status, 'driver reordered stops').toBeGreaterThanOrEqual(400)
})

test('driver cannot reach owner-only data: reports summary, users, settings write', async () => {
  const leaks = []
  for (const [m, p, b] of [['GET', '/api/users?page=1&pageSize=5'], ['PUT', '/api/settings', { COMPANY_NAME_EN: 'x' }]]) {
    const r = await call(driver.token, p, m, b)
    if (r.status < 300) leaks.push(`${m} ${p} -> ${r.status}`)
  }
  expect(leaks, 'a route driver can read tenant-wide totals or admin data').toEqual([])
})

test('BUG-39 driver dashboard summary pending bills are scoped to the driver route (ReportService.cs:441-455 ignores branch/route/staff)', async () => {
  const o = (await call(owner.token, '/api/reports/summary?refresh=true')).data
  const d = (await call(driver.token, '/api/reports/summary?refresh=true')).data
  expect(Number(o.salesToday) + Number(o.pendingBills), 'precondition: tenant has sales').toBeGreaterThan(0)
  expect({ sales: Number(d.salesToday), pending: Number(d.pendingBills) }, 'driver with no sales on route A sees tenant totals').toEqual({ sales: 0, pending: 0 })
})
