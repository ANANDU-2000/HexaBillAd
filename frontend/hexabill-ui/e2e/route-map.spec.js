// Route Map: list + map for one route with amounts owed, filters, search, a detail card, and a phone bottom sheet.
// Needs FeatureFlags__CustomerStopLocation=true (pins) on the synthetic API. Creates its own route and customers.
import { test, expect } from '@playwright/test'
import { signIn, apiLogin, API, EDGE } from './session.js'
import { createOwingCustomer } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

let fx
const stamp = `${Date.now()}`.slice(-8)

test.beforeAll(async () => {
  const branches = await ownerApi('/api/branches')
  let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `Map Branch ${stamp}` }) })).json.data?.id
  const routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `Map Route ${stamp}` }) })).json.data?.id
  let seq = 0
  const make = async (name, lat, lng) => {
    seq += 1
    const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify({ name, phone: `05${seq}${stamp}`.slice(0, 10), branchId, routeId, address: `${name} street`, mainLatitude: lat, mainLongitude: lng }) })
    expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
    return c.json.data?.id
  }
  const a = await make(`Map Alpha ${stamp}`, 25.2, 55.27)
  const b = await make(`Map Bravo ${stamp}`, 25.21, 55.28)
  const owing = await createOwingCustomer(SLUG, `Map Owing ${stamp}`) // has an invoice but no pin
  await ownerApi(`/api/routes/${routeId}/customers/${owing.id}`, { method: 'POST' })
  fx = { routeId, ids: [a, b], owingId: owing.id }
})

test.afterAll(async () => {
  if (!fx) return
  await ownerApi(`/api/routes/${fx.routeId}/customers/${fx.owingId}`, { method: 'DELETE' })
  for (const id of fx.ids) await ownerApi(`/api/customers/${id}`, { method: 'DELETE' })
  await ownerApi(`/api/routes/${fx.routeId}`, { method: 'DELETE' })
})

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function openMap (page) {
  // Tiles and road directions come from public services: keep the check offline and deterministic.
  await page.route('**/*.tile.openstreetmap.org/**', (route) => route.abort())
  await page.route('**/router.project-osrm.org/**', (route) => route.abort())
  await signIn(page, SLUG)
  await page.goto(`${page.url().split('/login')[0]}/route-map?route=${fx.routeId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('route-map-page')).toBeVisible()
  await expect(page.getByTestId('route-map-totals')).toBeVisible()
}

async function showList (page, desktop) {
  if (!desktop) await page.getByRole('button', { name: /Expand the stop list/ }).click()
  await expect(page.getByTestId('route-map-list')).toBeVisible()
}

test('list shows every stop with what is owed; no pin is flagged; pins appear on the map', async ({ page }, info) => {
  const desktop = page.viewportSize().width >= 1024
  await openMap(page)
  await showList(page, desktop)
  await expect(page.getByTestId(`stop-card-${fx.ids[0]}`)).toBeVisible()
  await expect(page.getByTestId(`stop-card-${fx.ids[1]}`)).toBeVisible()
  const owing = page.getByTestId(`stop-card-${fx.owingId}`)
  await expect(owing).toContainText('No pin')
  await expect(owing).toContainText(/[\d,]+\.\d{2}\s*AED/)
  await expect(page.locator('.leaflet-marker-icon').first()).toBeAttached()
  expect(await overflowX(page)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `e2e/.shots/route-map-${info.project.name}.png` })
})

test('search, "No pin" filter and sort narrow the list', async ({ page }) => {
  const desktop = page.viewportSize().width >= 1024
  await openMap(page)
  await showList(page, desktop)
  await page.getByLabel('Search customers').fill(`Bravo ${stamp}`)
  await expect(page.getByTestId(`stop-card-${fx.ids[1]}`)).toBeVisible()
  await expect(page.getByTestId(`stop-card-${fx.ids[0]}`)).toHaveCount(0)
  await page.getByLabel('Search customers').fill('')
  await page.getByLabel('Show me').selectOption('no_pin')
  await expect(page.getByTestId(`stop-card-${fx.owingId}`)).toBeVisible()
  await expect(page.getByTestId(`stop-card-${fx.ids[0]}`)).toHaveCount(0)
  await page.getByLabel('Show me').selectOption('all')
  await page.getByLabel('Sort by').selectOption('balance')
  const first = page.locator('[data-testid^="stop-card-"]').first()
  await expect(first).toHaveAttribute('data-testid', `stop-card-${fx.owingId}`) // only one with a balance
})

test('selecting a stop opens its detail card with actions; closing it clears the selection', async ({ page }) => {
  const desktop = page.viewportSize().width >= 1024
  await openMap(page)
  await showList(page, desktop)
  await page.getByTestId(`stop-card-${fx.ids[0]}`).click()
  const detail = page.getByTestId('stop-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText(`Map Alpha ${stamp}`)
  await expect(detail.getByRole('link', { name: 'Navigate' })).toHaveAttribute('href', /google\.com\/maps/)
  await expect(detail.getByRole('link', { name: 'Customer' })).toHaveAttribute('href', `/customers/${fx.ids[0]}`)
  expect(await overflowX(page)).toBeLessThanOrEqual(0)
  await detail.getByRole('button', { name: 'Close details' }).click()
  await expect(detail).toHaveCount(0)
})

test('without road directions the map says it is a straight line (desktop) and still works', async ({ page }) => {
  test.skip(page.viewportSize().width < 1024, 'the note is part of the desktop layout')
  await openMap(page)
  await expect(page.getByText('Straight-line route (road directions unavailable)')).toBeVisible()
})

test('phone: the list is a bottom sheet that expands and collapses', async ({ page }) => {
  test.skip(page.viewportSize().width >= 1024, 'phone and tablet layout only')
  await openMap(page)
  const sheet = page.getByTestId('route-map-sheet')
  await expect(sheet).toHaveAttribute('data-state', 'peek')
  await page.getByRole('button', { name: /Expand the stop list/ }).click()
  await expect(sheet).toHaveAttribute('data-state', 'half')
  await expect(page.getByTestId('route-map-list')).toBeVisible()
  await page.getByRole('button', { name: /Expand the stop list/ }).click()
  await expect(sheet).toHaveAttribute('data-state', 'full')
  await page.getByRole('button', { name: /Collapse the stop list/ }).click()
  await expect(sheet).toHaveAttribute('data-state', 'peek')
  expect(await overflowX(page)).toBeLessThanOrEqual(0)
})

test('office confirms a driver GPS fix as the shop pin (new pin, then a replacement)', async ({ page }) => {
  const day = new Date().toISOString().slice(0, 10)
  const putFix = async (customerId, latitude, longitude) => {
    const r = await ownerApi(`/api/routes/${fx.routeId}/visits/${customerId}`, { method: 'PUT', body: JSON.stringify({ visitDate: day, status: 'Arrived', latitude, longitude, reachedAt: new Date().toISOString() }) })
    expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBe(200)
  }
  const pinOf = async (customerId) => {
    const stop = (await ownerApi(`/api/routes/${fx.routeId}/stops-map?date=${day}`)).json.data.find((s) => s.customerId === customerId)
    return stop.mainLatitude == null ? null : Number(stop.mainLatitude)
  }
  await putFix(fx.owingId, 25.31, 55.41) // no saved pin yet
  await putFix(fx.ids[0], 25.5, 55.6) // far from its saved pin (25.2, 55.27)
  const desktop = page.viewportSize().width >= 1024
  await openMap(page)
  await showList(page, desktop)

  await page.getByTestId(`stop-card-${fx.owingId}`).click()
  const fix = page.getByTestId('pending-fix')
  await expect(fix).toContainText('no saved shop location')
  await fix.getByRole('button', { name: 'Confirm as shop pin' }).click()
  await expect(page.getByTestId('pending-fix')).toHaveCount(0)
  expect(await pinOf(fx.owingId)).toBeCloseTo(25.31, 3)

  if (!desktop) await page.getByRole('button', { name: /Expand the stop list/ }).click()
  await page.getByTestId(`stop-card-${fx.ids[0]}`).click()
  await expect(page.getByTestId('pending-fix')).toContainText('from the saved shop location')
  await page.getByTestId('pending-fix').getByRole('button', { name: 'Replace shop pin' }).click()
  await expect(page.getByTestId('pending-fix')).toHaveCount(0)
  expect(await pinOf(fx.ids[0])).toBeCloseTo(25.5, 3)
})
