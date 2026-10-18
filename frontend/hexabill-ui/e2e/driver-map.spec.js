// Driver map: the next stop is marked, "Navigate remaining stops" opens one ordered Google Maps link, "I'm here" sends one GPS reading with
// the arrival. A driver's fix stays on the visit; an owner's fix becomes the shop pin only when the stop has none.
// Needs FeatureFlags__CustomerStopLocation=true. Uses a fake position; real phone GPS is NOT tested here. Removes what it creates.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }
const FIX = { latitude: 25.2345, longitude: 55.3456, accuracy: 20 }

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function createDriver (stamp) {
  const email = `ux-mapdriver-${stamp}@hexabill.company`
  const password = `UxMapDriver-${stamp}-Pass!`
  const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX map driver ${stamp}`, email, password, role: 'Staff', phone: null }) })
  expect(created.status, JSON.stringify(created.json).slice(0, 200)).toBeLessThan(300)
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

const today = () => new Date().toISOString().slice(0, 10)

test('driver map: next stop, ordered navigation link, I\'m here (driver fix stays on the visit; owner fix becomes the pin)', async ({ page, browser }, info) => {
  test.setTimeout(240_000)
  const stamp = Date.now()
  const viewport = page.viewportSize()
  let routeId; let driver; const customerIds = []
  const contexts = []
  try {
    const branches = await ownerApi('/api/branches')
    let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
    if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Map Branch ${stamp}` }) })).json.data?.id
    routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Driver Map ${stamp}` }) })).json.data?.id
    const names = [`A1 ${stamp}`, `B2 ${stamp}`, `C3 nopin ${stamp}`] // no saved order yet: the server sorts by name
    for (const [i, name] of names.entries()) {
      const body = { name, phone: `05${i}${String(stamp).slice(-7)}`, branchId, routeId, address: `Street ${i + 1}` }
      if (i < 2) { body.mainLatitude = 25.2 + i * 0.01; body.mainLongitude = 55.27 + i * 0.01 }
      const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
      customerIds.push(c.json.data?.id)
    }
    driver = await createDriver(stamp)
    expect((await ownerApi(`/api/routes/${routeId}/staff/${driver.id}`, { method: 'POST' })).status).toBeLessThan(300)

    // --- Driver
    const driverContext = await browser.newContext({ viewport, geolocation: FIX, permissions: ['geolocation'] })
    contexts.push(driverContext)
    await driverContext.route('**/*.tile.openstreetmap.org/**', (route) => route.abort())
    await driverContext.route('**/router.project-osrm.org/**', (route) => route.abort())
    const dp = await driverContext.newPage()
    await signInAs(dp, driver)
    await dp.goto(`${feOrigin(SLUG)}/my-routes/${routeId}`, { waitUntil: 'networkidle' })
    await dp.getByRole('button', { name: 'Start route' }).click()
    await expect(dp.getByTestId('run-phase')).toHaveText('In progress')

    await expect(dp.getByTestId('next-stop')).toContainText(names[0])
    await expect(dp.getByTestId(`stop-${customerIds[0]}`)).toContainText('Next stop')
    const nav = dp.getByTestId('navigate-remaining')
    await expect(nav).toContainText('(2)') // the stop without a pin is left out
    const href = decodeURIComponent(await nav.getAttribute('href'))
    expect(href).toContain('destination=25.21,55.28')
    expect(href).toContain('waypoints=25.2,55.27')
    await expect(dp.getByTestId('navigate-note')).toContainText('no shop location')
    await expect(dp.getByText('Straight-line route')).toBeVisible() // routing service blocked in this test

    await dp.getByTestId('show-me').click()
    await expect(dp.getByTestId('im-here-note')).toBeVisible()

    await dp.screenshot({ path: `e2e/.shots/driver-map-${info.project.name}.png`, fullPage: true })

    // Driver presses "I'm here" at the stop without a pin: the fix is stored on the visit, not as the shop pin.
    await dp.getByTestId(`im-here-${customerIds[2]}`).click()
    await expect(dp.getByTestId(`stop-status-${customerIds[2]}`)).toHaveText('Arrived')
    const visits = (await ownerApi(`/api/routes/${routeId}/visits?date=${today()}`)).json.data
    const visit = visits.find((v) => v.customerId === customerIds[2])
    expect(Number(visit.latitude)).toBeCloseTo(FIX.latitude, 3)
    const afterDriver = (await ownerApi(`/api/routes/${routeId}/stops-map?date=${today()}`)).json.data.find((s) => s.customerId === customerIds[2])
    expect(afterDriver.needsLocation).toBe(true)
    expect(afterDriver.mainLatitude ?? null).toBeNull()

    // --- Owner at the same stop: the fix becomes the shop pin because the stop had none.
    await signIn(page, SLUG)
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(FIX)
    await page.goto(`${feOrigin(SLUG)}/my-routes/${routeId}`, { waitUntil: 'networkidle' })
    await page.getByTestId(`im-here-${customerIds[2]}`).click()
    await expect.poll(async () => {
      const stop = (await ownerApi(`/api/routes/${routeId}/stops-map?date=${today()}`)).json.data.find((s) => s.customerId === customerIds[2])
      return Number(stop.mainLatitude)
    }).toBeCloseTo(FIX.latitude, 3)

    // --- An existing pin is not overwritten by an arrival.
    await page.getByTestId(`im-here-${customerIds[0]}`).click()
    await expect(page.getByTestId(`stop-status-${customerIds[0]}`)).toHaveText('Arrived')
    const kept = (await ownerApi(`/api/routes/${routeId}/stops-map?date=${today()}`)).json.data.find((s) => s.customerId === customerIds[0])
    expect(Number(kept.mainLatitude)).toBeCloseTo(25.2, 3)
  } finally {
    for (const c of contexts) await c.close().catch(() => {})
    await ownerApi(`/api/routes/${routeId}/run/end`, { method: 'POST', body: JSON.stringify({}) }).catch(() => {})
    for (const id of customerIds) if (id) await ownerApi(`/api/customers/${id}`, { method: 'DELETE' })
    if (routeId) await ownerApi(`/api/routes/${routeId}`, { method: 'DELETE' })
    if (driver?.id) await ownerApi(`/api/users/${driver.id}`, { method: 'DELETE' })
  }
})
