// UX-06: a failed branch-expenses load on a route is an error with Try again, not "no branch-level expenses".
// The route is real (API, synthetic tenant); only the expense list response is mocked to fail, then to succeed.
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

test('route branch expenses: failure shows an error with retry, then recovers', async ({ page }) => {
  const branches = await api('/api/branches')
  let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!branchId) {
    const made = await api('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Audit Branch ${Date.now()}` }) })
    expect(made.status).toBeLessThan(300)
    branchId = made.json.data?.id
  }
  const created = await api('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Audit Route ${Date.now()}` }) })
  expect(created.status).toBeLessThan(300)
  const routeId = created.json.data?.id
  expect(routeId).toBeTruthy()

  await signIn(page, SLUG)
  let failing = true
  await page.route(/\/api\/expenses\?.*branchId=/, (route) => failing
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 9101, categoryName: 'Rent', note: 'UX branch rent', amount: 1500, date: '2026-10-01T00:00:00Z' }], totalCount: 1 } }) }))
  await page.goto(`${feOrigin(SLUG)}/routes/${routeId}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Expenses', exact: true }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'Branch expenses could not be loaded' })).toBeVisible()
  await expect(page.getByText("No branch-level expenses allocated to this route's branch.")).toHaveCount(0)

  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Branch expenses could not be loaded' })).toHaveCount(0)
  await expect(page.getByText('Branch Expenses Total:')).toBeVisible()
})
