// Live driver location, opt-in: nothing is requested until the driver reads the explanation and presses Start sharing; the
// office sees the position (no coordinates on screen) while the route runs; Stop sharing and End route delete it; a denied
// permission is explained and nothing is sent. Needs FeatureFlags__LiveDriverLocation=true and CustomerStopLocation=true.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function createStaff (stamp, label) {
  const email = `ux-${label}-${stamp}@hexabill.company`
  const password = `UxLive-${label}-${stamp}-Pass!`
  const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX ${label} ${stamp}`, email, password, role: 'Staff', phone: null }) })
  expect(created.status, `create ${label}: ${JSON.stringify(created.json).slice(0, 200)}`).toBeLessThan(300)
  return { id: created.json.data?.userId ?? created.json.data?.id ?? created.json.data?.Id, email, password }
}

async function signInAs (page, { email, password }) {
  const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HOST }, body: JSON.stringify({ email, password }) })
  expect(login.status).toBe(200)
  const d = (await login.json()).data || {}
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', JSON.stringify(s.user)) },
    { token: d.token || d.Token, user: { id: d.userId, role: 'Staff', name: d.name, tenantId: d.tenantId, assignedRouteIds: d.assignedRouteIds || [] } })
}

const countGeo = () => {
  window.__geoCalls = 0
  if (navigator.geolocation) {
    for (const fn of ['getCurrentPosition', 'watchPosition']) {
      const original = navigator.geolocation[fn].bind(navigator.geolocation)
      navigator.geolocation[fn] = (...args) => { window.__geoCalls++; return original(...args) }
    }
  }
}

async function fixture (stamp) {
  const branches = await ownerApi('/api/branches')
  let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Live Branch ${stamp}` }) })).json.data?.id
  const routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Live Route ${stamp}` }) })).json.data?.id
  const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify({ name: `Live Stop ${stamp}`, phone: `05${String(stamp).slice(-8)}`, branchId, routeId, address: 'Street 1', mainLatitude: 25.2, mainLongitude: 55.27 }) })
  expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
  const driver = await createStaff(stamp, 'driver')
  expect((await ownerApi(`/api/routes/${routeId}/staff/${driver.id}`, { method: 'POST' })).status).toBeLessThan(300)
  return { routeId, customerId: c.json.data?.id, driver }
}

const cleanup = async ({ routeId, customerId, driver }) => {
  if (customerId) await ownerApi(`/api/customers/${customerId}`, { method: 'DELETE' })
  if (routeId) await ownerApi(`/api/routes/${routeId}`, { method: 'DELETE' })
  if (driver?.id) await ownerApi(`/api/users/${driver.id}`, { method: 'DELETE' })
}

const liveList = async (routeId) => (await ownerApi(`/api/routes/${routeId}/location`)).json.data || []

test.describe('permission granted', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 25.2048, longitude: 55.2708, accuracy: 15 } })

  test('driver opts in, the office sees them, stop and end route delete the position', async ({ page, browser }) => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    const f = {}
    try {
      Object.assign(f, await fixture(stamp))
      const viewport = page.viewportSize()
      const driverContext = await browser.newContext({ viewport, permissions: ['geolocation'], geolocation: { latitude: 25.2048, longitude: 55.2708, accuracy: 15 } })
      const driverPage = await driverContext.newPage()
      await driverPage.addInitScript(countGeo)
      await signInAs(driverPage, f.driver)
      await driverPage.goto(`${feOrigin(SLUG)}/my-routes/${f.routeId}`, { waitUntil: 'networkidle' })

      // Not started: no sharing panel at all.
      await expect(driverPage.getByTestId('location-panel')).toHaveCount(0)
      await driverPage.getByRole('button', { name: 'Start route' }).click()
      await expect(driverPage.getByTestId('run-phase')).toHaveText('In progress')
      const panel = driverPage.getByTestId('location-panel')
      await expect(panel).toBeVisible()
      await expect(panel.getByTestId('sharing-status')).toContainText('not being shared')

      // Reading the explanation requests nothing, and "Not now" leaves it off.
      await panel.getByRole('button', { name: 'Share my location' }).click()
      const consent = panel.getByTestId('consent-box')
      await expect(consent).toContainText('owners and managers of this route')
      await expect(consent).toContainText('not a trail')
      expect(await driverPage.evaluate(() => window.__geoCalls)).toBe(0)
      await consent.getByRole('button', { name: 'Not now' }).click()
      expect(await driverPage.evaluate(() => window.__geoCalls)).toBe(0)
      expect(await liveList(f.routeId)).toHaveLength(0)

      // Start sharing: the position is sent, and the office sees it without coordinates.
      await panel.getByRole('button', { name: 'Share my location' }).click()
      await panel.getByRole('button', { name: 'Start sharing' }).click()
      await expect(panel.getByTestId('sharing-status')).toContainText(/Sharing\. Last sent/)
      expect(await driverPage.evaluate(() => window.__geoCalls)).toBeGreaterThan(0)
      await expect.poll(async () => (await liveList(f.routeId)).length).toBe(1)
      const row = (await liveList(f.routeId))[0]
      expect(row.isStale).toBe(false)
      expect(Number(row.latitude)).toBeCloseTo(25.2048, 3)

      await signIn(page, SLUG)
      await page.goto(`${feOrigin(SLUG)}/routes/${f.routeId}`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Stops & order' }).click()
      const card = page.getByTestId('driver-location-card')
      await expect(card).toContainText(`UX driver ${stamp}`)
      await expect(card).toContainText(/updated (just now|\d+ seconds? ago)/)
      await expect(card).not.toContainText(/25\.20/)
      await expect(page.locator('.leaflet-marker-icon', { hasText: 'DR' })).toHaveCount(1)

      // Stop sharing deletes the position at once.
      await panel.getByRole('button', { name: 'Stop sharing' }).click()
      await expect(panel.getByTestId('sharing-status')).toContainText('not being shared')
      await expect.poll(async () => (await liveList(f.routeId)).length).toBe(0)

      // Share again, then end the route: the position is gone and the panel disappears.
      await panel.getByRole('button', { name: 'Share my location' }).click()
      await panel.getByRole('button', { name: 'Start sharing' }).click()
      await expect.poll(async () => (await liveList(f.routeId)).length).toBe(1)
      await driverPage.getByRole('button', { name: 'End route' }).click()
      await driverPage.getByTestId('end-route-dialog').getByRole('button', { name: 'End route' }).click()
      await expect(driverPage.getByTestId('run-phase')).toHaveText('Finished')
      await expect(driverPage.getByTestId('location-panel')).toHaveCount(0)
      await expect.poll(async () => (await liveList(f.routeId)).length).toBe(0)
      await driverContext.close()
    } finally {
      await cleanup(f)
    }
  })
})

test.describe('permission denied', () => {
  test('a denied permission is explained, nothing is sent, and the route still works', async ({ browser, page }) => {
    test.setTimeout(120_000)
    const stamp = Date.now()
    const f = {}
    try {
      Object.assign(f, await fixture(stamp))
      const driverContext = await browser.newContext({ viewport: page.viewportSize(), permissions: [] })
      const driverPage = await driverContext.newPage()
      await signInAs(driverPage, f.driver)
      await driverPage.goto(`${feOrigin(SLUG)}/my-routes/${f.routeId}`, { waitUntil: 'networkidle' })
      await driverPage.getByRole('button', { name: 'Start route' }).click()
      const panel = driverPage.getByTestId('location-panel')
      await panel.getByRole('button', { name: 'Share my location' }).click()
      await panel.getByRole('button', { name: 'Start sharing' }).click()
      await expect(panel.getByTestId('sharing-status')).toContainText('permission is off')
      expect(await liveList(f.routeId)).toHaveLength(0)
      // The stops still work.
      await driverPage.getByRole('button', { name: 'Delivered' }).first().click()
      await expect(driverPage.getByTestId(`stop-status-${f.customerId}`)).toHaveText('Delivered')
      await driverContext.close()
    } finally {
      await cleanup(f)
    }
  })
})
