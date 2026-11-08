// UX-F01..F03: one-button stops, auto Arrived from (mocked) GPS near the next stop's pin, nearest-first re-order with Undo.
// Real API for the route data (synthetic tenant, removed afterwards); geolocation is mocked by the browser context.
// Needs FeatureFlags__CustomerStopLocation=true (as route-driver-flow). Run: --project=d1440 --project=m360
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/uiux/evidence/2026-11-08')
fs.mkdirSync(EVIDENCE, { recursive: true })

async function ownerApi (p, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${p}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const LAT = 25.2
const LNG = 55.3
// owner order: s1, s2, s3, s4, s5. Longitude offsets: s1 0, s2 .05, s3 .01, s4 .04, s5 .02 -> nearest-first after s1 is s3, s5, s4, s2.
const OFFSETS = [0, 0.05, 0.01, 0.04, 0.02]

test('auto Arrived near the next pin (once, source auto), Delivered re-orders nearest-first, Undo restores', async ({ page }, info) => {
  test.setTimeout(170_000)
  const stamp = Date.now()
  let routeId; const customerIds = []
  try {
    const branches = await ownerApi('/api/branches')
    let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
    if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Auto Branch ${stamp}` }) })).json.data?.id
    routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Auto Route ${stamp}` }) })).json.data?.id
    expect(routeId).toBeTruthy()
    const names = OFFSETS.map((_, i) => `S${i + 1} Auto ${stamp}`)
    for (const [i, name] of names.entries()) {
      const body = { name, phone: `05${i}${String(stamp).slice(-7)}`, branchId, routeId, address: `Lane ${i + 1}`, mainLatitude: LAT, mainLongitude: LNG + OFFSETS[i] }
      const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
      customerIds.push(c.json.data?.id)
    }

    // Scripted geolocation (deterministic: the browser's own mock does not push updates to active watchers on every engine).
    await page.addInitScript(() => {
      const watchers = new Map(); let seq = 0; let pos = null
      const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 10 }, timestamp: Date.now() })
      navigator.geolocation.watchPosition = (ok) => { const i = ++seq; watchers.set(i, ok); if (pos) setTimeout(() => ok(mk(pos)), 0); return i }
      navigator.geolocation.clearWatch = (i) => { watchers.delete(i) }
      navigator.geolocation.getCurrentPosition = (ok) => { if (pos) ok(mk(pos)) }
      window.__setPos = (lat, lng) => { pos = { lat, lng }; watchers.forEach((cb) => cb(mk(pos))) }
      window.__watchers = () => watchers.size
    })
    const setPos = (lat, lng) => page.evaluate(([a, b]) => window.__setPos(a, b), [lat, lng])
    const visits = []
    page.on('request', (r) => { if (r.method() === 'PUT' && /\/routes\/\d+\/visits\/\d+$/.test(r.url())) visits.push({ id: Number(r.url().split('/').pop()), body: JSON.parse(r.postData() || '{}') }) })
    page.on('response', (r) => { if (r.request().method() === 'PUT' && /visits/.test(r.url())) console.log('VISIT', r.status(), r.request().postData()) })
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/my-routes/${routeId}`, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('run-phase')).toHaveText('Not started')

    await page.evaluate(([a, b]) => window.__setPos(a, b), [LAT + 0.01, LNG]) // ~1.1 km north of stop 1
    expect(await page.evaluate(() => window.__watchers())).toBe(0) // nothing watches before Start
    await page.getByRole('button', { name: 'Start route' }).click()
    await page.getByRole('button', { name: 'Start with auto location' }).click()
    await expect(page.getByTestId('run-phase')).toHaveText('In progress')
    await expect(page.getByTestId('tracker-status')).toContainText('Auto location is on')
    const next = page.getByTestId('next-stop')
    await expect(next).toContainText(names[0])
    // one big Delivered, a smaller Problem, Navigate: at most 3 buttons/links
    await expect(next.getByRole('button')).toHaveCount(2)
    await expect(next.getByRole('link', { name: 'Navigate' })).toHaveCount(1)
    await expect(next.getByTestId('next-distance')).toBeVisible()
    const box = await next.boundingBox() // the whole next-stop card is above the fold (bottom nav is ~76 px)
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height - 70)
    await page.screenshot({ path: path.join(EVIDENCE, `F01-${info.project.name}-next-stop.png`) })
    expect(visits.filter((v) => v.body.status === 'Arrived')).toHaveLength(0) // far away: nothing sent

    // Move within ~40 m of the pin; Arrived needs 20 s inside the radius.
    await setPos(LAT + 0.00036, LNG)
    await page.waitForTimeout(21000)
    await setPos(LAT + 0.00035, LNG)
    await expect(page.getByTestId(`stop-status-${customerIds[0]}`)).toHaveText('Arrived', { timeout: 20000 })
    await expect(page.getByText(`Arrived at ${names[0]}`).first()).toBeVisible()
    const arrived = visits.filter((v) => v.body.status === 'Arrived')
    expect(arrived).toHaveLength(1)
    expect(arrived[0].body.source).toBe('auto')
    expect(arrived[0].id).toBe(customerIds[0])
    await setPos(LAT + 0.00034, LNG)
    await page.waitForTimeout(1500)
    expect(visits.filter((v) => v.body.status === 'Arrived')).toHaveLength(1) // still once

    // Delivered: the remaining stops are re-ordered nearest-first, with Undo.
    await next.getByRole('button', { name: 'Delivered' }).click()
    await expect(page.getByTestId('route-progress')).toHaveText('1 / 5 done')
    await expect(page.getByTestId('reorder-undo')).toBeVisible()
    await expect(page.getByTestId('next-stop')).toContainText(names[2]) // s3 is nearest to s1
    const rows = page.getByTestId('stop-list').locator('> li')
    await expect(rows.nth(0)).toContainText(names[0]) // delivered stays first
    await expect(rows.nth(1)).toContainText(names[4]) // then s5
    await page.screenshot({ path: path.join(EVIDENCE, `F03-${info.project.name}-reordered.png`) })
    await page.getByTestId('reorder-undo').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('next-stop')).toContainText(names[1]) // owner's order again: s2
    await expect(page.getByTestId('reorder-undo')).toHaveCount(0)

    await page.getByRole('button', { name: 'End route' }).first().click()
    await page.getByTestId('end-route-dialog').getByRole('button', { name: 'End route' }).click()
    await expect(page.getByTestId('run-phase')).toHaveText('Finished')
    expect(await page.evaluate(() => window.__watchers())).toBe(0) // End route stops the watch
  } finally {
    for (const id of customerIds) if (id) await ownerApi(`/api/customers/${id}`, { method: 'DELETE' })
    if (routeId) await ownerApi(`/api/routes/${routeId}`, { method: 'DELETE' })
  }
})
