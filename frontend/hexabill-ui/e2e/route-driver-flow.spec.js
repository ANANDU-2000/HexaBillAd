// Ordered route MVP end to end on the synthetic tenant: the owner orders the stops, the assigned driver starts the route,
// works the stops in order (arrived, delivered, failed with a reason, skipped), ends it and sees the frozen counts. Another
// staff member sees nothing. Location is never requested by the app (the geolocation API is counted and must stay at zero).
// Needs FeatureFlags__CustomerStopLocation=true. Removes what it creates.
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
  const password = `UxRoute-${label}-${stamp}-Pass!`
  const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX ${label} ${stamp}`, email, password, role: 'Staff', phone: null }) })
  expect(created.status, `create ${label}: ${JSON.stringify(created.json).slice(0, 200)}`).toBeLessThan(300)
  const id = created.json.data?.userId ?? created.json.data?.id ?? created.json.data?.Id
  return { id, email, password }
}

async function signInAs (page, { email, password }) {
  const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HOST }, body: JSON.stringify({ email, password }) })
  expect(login.status).toBe(200)
  const d = (await login.json()).data || {}
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', JSON.stringify(s.user)) },
    { token: d.token || d.Token, user: { id: d.userId, role: 'Staff', name: d.name, tenantId: d.tenantId, assignedRouteIds: d.assignedRouteIds || [] } })
}

test('route: owner orders stops, driver runs the route in order, nothing asks for location', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const stamp = Date.now()
  let routeId; let driver; let other; const customerIds = []
  try {
    const branches = await ownerApi('/api/branches')
    let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
    if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Route Branch ${stamp}` }) })).json.data?.id
    routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Driver Route ${stamp}` }) })).json.data?.id
    expect(routeId).toBeTruthy()
    const names = [`A Stop ${stamp}`, `B Stop ${stamp}`, `C Stop ${stamp}`]
    for (const [i, name] of names.entries()) {
      const body = { name, phone: `05${i}${String(stamp).slice(-7)}`, branchId, routeId, address: `Street ${i + 1}` }
      if (i < 2) { body.mainLatitude = 25.2 + i * 0.01; body.mainLongitude = 55.27 + i * 0.01 }
      const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
      customerIds.push(c.json.data?.id)
    }
    driver = await createStaff(stamp, 'driver')
    other = await createStaff(stamp, 'other')
    expect((await ownerApi(`/api/routes/${routeId}/staff/${driver.id}`, { method: 'POST' })).status).toBeLessThan(300)

    // --- Owner: the stops table is numbered, and moving a stop is stored.
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/routes/${routeId}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Stops & order' }).click()
    const table = page.getByTestId('stops-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    await expect(page.getByTestId('planner-location-needed')).toContainText(names[2])
    const rowsText = async () => (await table.locator('tbody tr td:nth-child(2) .font-medium').allTextContents()).map((t) => t.trim())
    await expect.poll(rowsText).toEqual(names)
    const moved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/stops\/order$/.test(r.url()))
    await page.getByRole('button', { name: `Make ${names[2]} the first stop` }).click()
    expect((await moved).status()).toBe(200)
    await expect.poll(rowsText).toEqual([names[2], names[0], names[1]])
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Stops & order' }).click()
    await expect.poll(rowsText).toEqual([names[2], names[0], names[1]])
    const order = (await ownerApi(`/api/routes/${routeId}/stops-map`)).json.data.map((s) => s.customerName)
    expect(order).toEqual([names[2], names[0], names[1]])

    // --- Driver: never asked for location.
    // Separate browser contexts: the app keeps its session in localStorage, which a shared context would overwrite.
    const viewport = page.viewportSize()
    const driverContext = await browser.newContext({ viewport })
    const driverPage = await driverContext.newPage()
    await driverPage.addInitScript(() => {
      window.__geoCalls = 0
      if (navigator.geolocation) {
        for (const fn of ['getCurrentPosition', 'watchPosition']) {
          const original = navigator.geolocation[fn].bind(navigator.geolocation)
          navigator.geolocation[fn] = (...args) => { window.__geoCalls++; return original(...args) }
        }
      }
    })
    await signInAs(driverPage, driver)
    await driverPage.goto(`${feOrigin(SLUG)}/my-routes`, { waitUntil: 'networkidle' })
    await expect(driverPage.getByRole('link', { name: new RegExp(`UX Driver Route ${stamp}`) })).toBeVisible()
    await driverPage.getByRole('link', { name: new RegExp(`UX Driver Route ${stamp}`) }).click()
    await expect(driverPage.getByTestId('run-phase')).toHaveText('Not started')
    // Before Start there are no outcome buttons.
    await expect(driverPage.getByRole('button', { name: 'Delivered' })).toHaveCount(0)
    const list = driverPage.getByTestId('stop-list').locator('> li')
    await expect(list).toHaveCount(3)
    await expect(list.nth(0)).toContainText(names[2])
    await expect(list.nth(0)).toContainText('Street 3')
    await expect(list.nth(1)).toContainText(names[0])
    // Navigation link only for stops with a saved location; the third (first in order) has none.
    await expect(list.nth(0).getByRole('link', { name: /Open in maps/ })).toHaveCount(0)
    await expect(list.nth(1).getByRole('link', { name: /Open in maps/ })).toHaveCount(1)
    await expect(driverPage.getByTestId('location-needed')).toContainText(names[2])
    await expect(driverPage.getByTestId('payments-note')).toBeVisible()
    await expect(driverPage.getByRole('link', { name: /Record payment/ })).toHaveCount(0)

    await driverPage.getByRole('button', { name: 'Start route' }).click()
    await expect(driverPage.getByTestId('run-phase')).toHaveText('In progress')

    // Stop 1 (no location): arrived, then delivered.
    const stop = (name) => driverPage.getByTestId('stop-list').locator('> li').filter({ hasText: name })
    await stop(names[2]).getByRole('button', { name: 'Arrived' }).click()
    await expect(stop(names[2]).getByTestId(`stop-status-${customerIds[2]}`)).toHaveText('Arrived')
    await stop(names[2]).getByRole('button', { name: 'Delivered' }).click()
    await expect(stop(names[2]).getByTestId(`stop-status-${customerIds[2]}`)).toHaveText('Delivered')
    // Stop 2: failed needs a reason.
    await stop(names[0]).getByRole('button', { name: 'Failed' }).click()
    const save = stop(names[0]).getByRole('button', { name: /Save failed/ })
    await expect(save).toBeDisabled()
    await stop(names[0]).getByRole('textbox').fill('ab')
    await expect(save).toBeDisabled()
    await stop(names[0]).getByRole('textbox').fill('Shop closed for stocktake')
    await expect(save).toBeEnabled()
    await save.click()
    await expect(stop(names[0]).getByTestId(`stop-status-${customerIds[0]}`)).toHaveText('Failed')
    // Stop 3 stays unvisited. End the route: the dialog warns about the missed stop.
    await driverPage.getByRole('button', { name: 'End route' }).click()
    const dialog = driverPage.getByTestId('end-route-dialog')
    await expect(dialog).toContainText('1 stop has not been visited')
    await dialog.getByLabel(/Note for the office/).fill('Back at depot')
    await dialog.getByRole('button', { name: 'End route' }).click()
    await expect(driverPage.getByTestId('run-phase')).toHaveText('Finished')
    await expect(driverPage.getByTestId('summary-delivered')).toHaveText('1')
    await expect(driverPage.getByTestId('summary-failed')).toHaveText('1')
    await expect(driverPage.getByTestId('summary-notVisited')).toHaveText('1')
    expect(await driverPage.evaluate(() => window.__geoCalls)).toBe(0)

    // The owner sees the frozen result and the driver's note on the route.
    const run = (await ownerApi(`/api/routes/${routeId}/run`)).json.data.last
    expect([run.stopsTotal, run.stopsDelivered, run.stopsFailed, run.stopsNotVisited]).toEqual([3, 1, 1, 1])
    expect(run.endNote).toBe('Back at depot')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Stops & order' }).click()
    await expect(page.getByTestId('route-run-card')).toContainText('Back at depot')

    // --- Another staff member: the route does not exist for them.
    const otherContext = await browser.newContext({ viewport })
    const otherPage = await otherContext.newPage()
    await signInAs(otherPage, other)
    await otherPage.goto(`${feOrigin(SLUG)}/my-routes/${routeId}`, { waitUntil: 'networkidle' })
    await expect(otherPage.getByText('This route was not found')).toBeVisible()
    await otherPage.goto(`${feOrigin(SLUG)}/my-routes`, { waitUntil: 'networkidle' })
    await expect(otherPage.getByRole('link', { name: new RegExp(`UX Driver Route ${stamp}`) })).toHaveCount(0)
    await driverContext.close()
    await otherContext.close()
  } finally {
    for (const id of customerIds) if (id) await ownerApi(`/api/customers/${id}`, { method: 'DELETE' })
    if (routeId) await ownerApi(`/api/routes/${routeId}`, { method: 'DELETE' })
    for (const u of [driver, other]) if (u?.id) await ownerApi(`/api/users/${u.id}`, { method: 'DELETE' })
  }
})
