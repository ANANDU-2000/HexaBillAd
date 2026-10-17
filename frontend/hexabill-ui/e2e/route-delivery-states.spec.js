// Delivery states on the route collection sheet: Failed and Skipped need a reason, Delivered saves at once, and what is
// saved is read back through the API. Real branch, route and customer on the synthetic tenant.
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

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function fixture () {
  const branches = await api('/api/branches')
  let branchId = (branches.json.data?.items ?? branches.json.data ?? [])[0]?.id
  if (!branchId) {
    const made = await api('/api/branches', { method: 'POST', body: JSON.stringify({ name: `UX Audit Branch ${Date.now()}` }) })
    expect(made.status).toBeLessThan(300)
    branchId = made.json.data?.id
  }
  const route = await api('/api/routes', { method: 'POST', body: JSON.stringify({ branchId, name: `UX Delivery Route ${Date.now()}` }) })
  expect(route.status).toBeLessThan(300)
  const routeId = route.json.data?.id
  const name = `Delivery Buyer ${Date.now()}`
  const customer = await api('/api/customers', { method: 'POST', body: JSON.stringify({ name, phone: '05' + String(Date.now()).slice(-8), branchId, routeId }) })
  expect(customer.status, JSON.stringify(customer.json)).toBeLessThan(300)
  return { routeId, customerId: customer.json.data?.id, name }
}

async function visitFor (routeId, customerId) {
  const r = await api(`/api/routes/${routeId}/visits?date=${localToday()}`)
  return (r.json.data ?? []).find((v) => v.customerId === customerId)
}

test('collection sheet: delivered saves at once; failed and skipped need a reason', async ({ page }) => {
  const { routeId, customerId, name } = await fixture()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/routes/${routeId}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Collection sheet' }).click()
  const sheet = page.getByRole('dialog').filter({ hasText: 'Daily Collection Sheet' })
  await expect(sheet).toBeVisible()
  const row = sheet.locator('tr').filter({ hasText: name })
  await expect(row).toBeVisible()
  const select = row.getByRole('combobox')

  // Delivered: no reason needed, saved straight away.
  await select.selectOption('Delivered')
  await expect.poll(async () => (await visitFor(routeId, customerId))?.status).toBe('Delivered')

  // Failed: a reason field appears, nothing is saved yet, Save stays disabled until the reason is real.
  await select.selectOption('Failed')
  const reason = row.getByLabel(/^Reason/)
  await expect(reason).toBeVisible()
  expect((await visitFor(routeId, customerId)).status).toBe('Delivered') // unchanged so far
  const save = row.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()
  await reason.fill('ab')
  await expect(save).toBeDisabled()
  await reason.fill('Gate locked, nobody answered')
  await expect(save).toBeEnabled()
  await save.click()
  await expect.poll(async () => (await visitFor(routeId, customerId))?.status).toBe('Failed')
  expect((await visitFor(routeId, customerId)).notes).toBe('Gate locked, nobody answered')
  await expect(row.getByLabel(/^Reason/)).toHaveCount(0)

  // Skipped: Cancel leaves the saved state alone.
  await select.selectOption('Skipped')
  await expect(row.getByLabel(/^Reason/)).toBeVisible()
  await row.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(row.getByLabel(/^Reason/)).toHaveCount(0)
  expect((await visitFor(routeId, customerId)).status).toBe('Failed')
})
