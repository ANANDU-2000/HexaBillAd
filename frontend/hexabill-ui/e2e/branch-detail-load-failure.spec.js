// UX-06: a failed Customers or Staff load on a branch is an error with Try again, not "no customers/staff".
// The branch is real (API, synthetic tenant); only the two list responses are mocked to fail, then to succeed.
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

async function branchId () {
  const branches = await api('/api/branches')
  let id = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!id) {
    const made = await api('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Audit Branch ${Date.now()}` }) })
    expect(made.status).toBeLessThan(300)
    id = made.json.data?.id
  }
  expect(id).toBeTruthy()
  return id
}

test('branch customers: failure shows an error with retry, then recovers', async ({ page }) => {
  const id = await branchId()
  await signIn(page, SLUG)
  let failing = true
  await page.route(/\/api\/customers\?.*branchId=/, (route) => failing
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 9001, name: 'UX Branch Customer', phone: '0500000000', balance: 0 }], totalCount: 1 } }) }))
  await page.goto(`${feOrigin(SLUG)}/branches/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Customers', exact: true }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'Customers could not be loaded' })).toBeVisible()
  await expect(page.getByText('No customers in this branch.')).toHaveCount(0)

  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Customers could not be loaded' })).toHaveCount(0)
  await expect(page.getByText('UX Branch Customer').filter({ visible: true }).first()).toBeVisible()
})

test('branch staff: failure shows an error with retry, then recovers', async ({ page }) => {
  const id = await branchId()
  await signIn(page, SLUG)
  let failing = true
  await page.route(/\/api\/users(\?.*)?$/, (route) => failing
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 9002, name: 'UX Branch Staff', email: 'ux@example.test', role: 'Staff', assignedBranchIds: [id] }] } }) }))
  await page.goto(`${feOrigin(SLUG)}/branches/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Staff', exact: true }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'Staff could not be loaded' })).toBeVisible()
  await expect(page.getByText('No staff assigned to this branch.')).toHaveCount(0)

  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('UX Branch Staff').filter({ visible: true }).first()).toBeVisible()
})
