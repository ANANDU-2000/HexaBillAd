// UX-02 (S189): the route sales tab shows invoice cards on phones with no sideways scrolling.
// The route is real (created through the API on the synthetic tenant); only the invoice LIST response is
// mocked so the layout is checked with long names and several statuses. Rendering test, not a data test.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const FAKE = [
  { id: 9001, invoiceNo: 'INV-UX-0001', customerName: 'Al Noor Trading And General Wholesale Supplies L.L.C - S.P.C', invoiceDate: '2026-10-10T08:00:00Z', grandTotal: 1234.5, status: 'Paid' },
  { id: 9002, invoiceNo: 'INV-UX-0002', customerName: 'Gulf Harvest Cash Customer', invoiceDate: '2026-10-11T08:00:00Z', grandTotal: 99.99, status: 'Partial' },
  { id: 9003, invoiceNo: 'INV-UX-0003', customerName: 'Frozen Hub', invoiceDate: '2026-10-12T08:00:00Z', grandTotal: 15.75, status: 'Pending' },
]

test('route sales: cards on phones without sideways scrolling; table from tablet up', async ({ page }) => {
  const branches = await api('/api/branches')
  let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!branchId) {
    const madeBranch = await api('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Audit Branch ${Date.now()}` }) })
    expect(madeBranch.status, 'branch create').toBeLessThan(300)
    branchId = madeBranch.json.data?.id
  }
  expect(branchId, 'a branch must exist on the synthetic tenant').toBeTruthy()
  const created = await api('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Audit Route ${Date.now()}` }) })
  expect(created.status).toBeLessThan(300)
  const routeId = created.json.data?.id
  expect(routeId).toBeTruthy()

  await signIn(page, SLUG)
  await page.route(/\/api\/sales\?.*routeId=/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: FAKE, totalCount: FAKE.length, page: 1, pageSize: 100 } }),
  }))
  await page.goto(`${feOrigin(SLUG)}/routes/${routeId}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Sales', exact: true }).click()

  const vp = page.viewportSize()
  const phone = vp.width < 768
  if (phone) {
    const list = page.getByRole('list', { name: 'Route invoices' })
    await expect(list).toBeVisible()
    await expect(list.getByRole('listitem')).toHaveCount(3)
    const view = list.getByRole('button', { name: 'View invoice INV-UX-0001' })
    const box = await view.boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(43)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    await expect(list).toContainText('Al Noor Trading And General Wholesale Supplies')
    // No sideways scroller in the invoice panel (the tab bar is a deliberate scroller and is excluded).
    const scrollers = await page.evaluate(() => [...document.querySelectorAll('main *')]
      .filter((el) => !el.querySelector('nav') && !el.closest('nav'))
      .filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1 && el.getClientRects().length).length)
    expect(scrollers).toBe(0)
  } else {
    await expect(page.getByRole('list', { name: 'Route invoices' })).toBeHidden()
    await expect(page.getByRole('columnheader', { name: 'Invoice No' })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})
