// UX-F04 owner route builder and UX-F05 empty states. Owner view on the synthetic tenant. The F04 test creates a route with three
// customers (two pinned, one not), previews "Optimize order", saves it, and removes what it created. The F05 test mocks an empty
// branch/route list so the guided setup card shows. Screenshots go to docs/uiux/evidence/2026-11-08.
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

test('F04: owner previews the nearest-first order, saves it once, and sees a Pin now action on the unpinned stop', async ({ page }, info) => {
  test.setTimeout(170_000)
  const stamp = Date.now()
  let routeId; const customerIds = []
  try {
    const branches = await ownerApi('/api/branches')
    let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
    if (!branchId) branchId = (await ownerApi('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Builder Branch ${stamp}` }) })).json.data?.id
    routeId = (await ownerApi('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Builder Route ${stamp}` }) })).json.data?.id
    expect(routeId).toBeTruthy()
    // owner order: far pinned, unpinned, near pinned. Nearest-first starts at the first pinned stop (Far) and then goes to Near; the unpinned stop goes last.
    const plan = [
      { name: `Far Stop ${stamp}`, mainLatitude: 25.3, mainLongitude: 55.3 },
      { name: `No Pin Stop ${stamp}`, mainLatitude: null, mainLongitude: null },
      { name: `Near Stop ${stamp}`, mainLatitude: 25.201, mainLongitude: 55.3 },
    ]
    for (const [i, p] of plan.entries()) {
      const body = { name: p.name, phone: `05${i}${String(stamp).slice(-7)}`, branchId, routeId, address: `Builder ${i + 1}`, ...(p.mainLatitude != null ? { mainLatitude: p.mainLatitude, mainLongitude: p.mainLongitude } : {}) }
      const c = await ownerApi('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      expect(c.status, JSON.stringify(c.json).slice(0, 200)).toBeLessThan(300)
      customerIds.push(c.json.data?.id)
    }

    // The server's order can already be the shortest one, so set the owner's order explicitly: Far, No pin, Near.
    const set = await ownerApi(`/api/routes/${routeId}/stops/order`, { method: 'PUT', body: JSON.stringify({ customerIds: [customerIds[0], customerIds[1], customerIds[2]] }) })
    expect(set.status, JSON.stringify(set.json).slice(0, 200)).toBeLessThan(300)
    await expect.poll(async () => (await ownerApi(`/api/routes/${routeId}/stops-map`)).json.data.map((s) => s.customerName)).toEqual([`Far Stop ${stamp}`, `No Pin Stop ${stamp}`, `Near Stop ${stamp}`])

    await signIn(page, SLUG)
    await page.addInitScript(() => { try { localStorage.setItem('hexabill.route.autoReorder', '1') } catch { /* blocked */ } })
    await page.goto(`${feOrigin(SLUG)}/routes/${routeId}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Stops & order' }).click()
    const table = page.getByTestId('stops-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    await expect(page.getByTestId(`pin-now-${customerIds[1]}`)).toBeVisible()

    await page.getByTestId('optimize-order').click()
    const preview = page.getByTestId('optimize-preview')
    await expect(preview.locator('li').nth(1)).toContainText(`Near Stop ${stamp}`)
    expect(await ownerApi(`/api/routes/${routeId}/stops-map`).then((r) => r.json.data.map((s) => s.customerName))).toEqual([`Far Stop ${stamp}`, `No Pin Stop ${stamp}`, `Near Stop ${stamp}`])
    await page.screenshot({ path: path.join(EVIDENCE, `F04-${info.project.name}-optimize-preview.png`), fullPage: false })

    await preview.getByRole('button', { name: 'Save this order' }).click()
    await expect(page.getByTestId('optimize-preview')).toHaveCount(0)
    await expect.poll(async () => (await ownerApi(`/api/routes/${routeId}/stops-map`)).json.data.map((s) => s.customerName)).toEqual([`Far Stop ${stamp}`, `Near Stop ${stamp}`, `No Pin Stop ${stamp}`])
    await expect(table.locator('tbody tr').nth(1)).toContainText(`Near Stop ${stamp}`)
    await page.screenshot({ path: path.join(EVIDENCE, `F04-${info.project.name}-saved.png`) })
  } finally {
    for (const id of customerIds) if (id) await ownerApi(`/api/customers/${id}`, { method: 'DELETE' })
    if (routeId) await ownerApi(`/api/routes/${routeId}`, { method: 'DELETE' })
  }
})

test('F05: with no branches or routes, Branches & Routes shows one guided setup card', async ({ page }, info) => {
  await page.route((url) => url.pathname === '/api/branches' || url.pathname === '/api/routes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/branches?tab=routes`, { waitUntil: 'networkidle' })
  const guide = page.getByTestId('routes-setup-guide')
  await expect(guide).toBeVisible()
  await expect(page.getByTestId('guide-step-branch')).toHaveAttribute('data-state', 'current')
  await expect(page.getByTestId('guide-step-route')).toHaveAttribute('data-state', 'todo')
  await expect(page.getByTestId('guide-step-customers')).toHaveAttribute('data-state', 'todo')
  await expect(guide.getByRole('button', { name: 'Add branch' })).toBeVisible()
  await page.screenshot({ path: path.join(EVIDENCE, `F05-${info.project.name}-setup-guide.png`) })
})
