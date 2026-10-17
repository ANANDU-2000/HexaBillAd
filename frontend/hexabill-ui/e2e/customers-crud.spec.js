// Customers: add through the form, edit the credit limit, delete a customer with no transactions; all confirmed through
// the API. A customer WITH transactions asks for a typed confirmation before a force delete, and the test cancels it
// (a force delete removes the customer's invoices and payments, so it is never confirmed here).
// Synthetic local tenant only; the test removes what it adds.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []
const findByName = async (name) => items((await api(`/api/customers?page=1&pageSize=100&search=${encodeURIComponent(name)}`)).json).find((c) => c.name === name) || null

async function removeLeftovers () {
  for (const c of items((await api('/api/customers?page=1&pageSize=100&search=UX%20Cust')).json)) {
    if (/^UX Cust /.test(c.name || '') && !Number(c.balance)) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
  }
}

async function openRowMenu (page, name) {
  await page.getByRole('searchbox', { name: 'Search customers' }).or(page.getByLabel('Search customers')).first().fill(name)
  const menuButton = page.getByRole('button', { name: `More actions for ${name}` }).filter({ visible: true })
  // The list filters and reloads after typing: wait until it is down to this one customer and the page is quiet.
  await expect(page.getByRole('button', { name: /^More actions for / }).filter({ visible: true })).toHaveCount(1)
  await page.waitForLoadState('networkidle')
  await menuButton.first().click()
  await expect(page.getByRole('menu').first()).toBeVisible()
}

test('customer: add -> stored -> edit credit limit -> delete (no transactions)', async ({ page }) => {
  await removeLeftovers()
  const stamp = Date.now()
  const name = `UX Cust ${stamp}`
  const phone = `0501${String(stamp).slice(-6)}`
  try {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Add customer' }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/Customer Name/).fill(name)
    await dialog.getByLabel(/Phone/).first().fill(phone)
    await dialog.getByLabel('Credit Limit').fill('500')
    // A credit limit needs payment terms; a company with branches needs a branch, and then a route: the form refuses without them.
    await dialog.locator('select[name="paymentTerms"]').selectOption({ index: 1 })
    await dialog.locator('select[name="branchId"]').selectOption({ index: 1 })
    // Choosing a branch makes the route required; its options load after the branch is picked.
    await expect(dialog.locator('select[name="routeId"] option')).not.toHaveCount(1)
    await dialog.locator('select[name="routeId"]').selectOption({ index: 1 })
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/customers$/.test(r.url()))
    await dialog.getByRole('button', { name: 'Add Customer', exact: true }).click()
    const res = await created
    if (res.status() >= 300) throw new Error(`POST /api/customers ${res.status()}: ${await res.text()}`)
    await expect(dialog).toBeHidden()
    await expect.poll(async () => Number((await findByName(name))?.creditLimit)).toBe(500)
    expect((await findByName(name)).phone).toBe(phone)

    // Edit the credit limit through the row menu.
    await openRowMenu(page, name)
    await page.getByRole('menuitem', { name: 'Edit customer' }).click()
    const edit = page.getByRole('dialog').first()
    await expect(edit).toBeVisible()
    await edit.getByLabel('Credit Limit').fill('750')
    const updated = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/customers\/\d+$/.test(r.url()))
    await edit.getByRole('button', { name: /Update|Save/ }).click()
    expect((await updated).status()).toBeLessThan(300)
    await expect.poll(async () => Number((await findByName(name))?.creditLimit)).toBe(750)

    // Delete: no transactions, so a plain confirmation (no typed word).
    await openRowMenu(page, name)
    await page.getByRole('menuitem', { name: 'Delete customer' }).click()
    const confirm = page.getByRole('dialog').first()
    await expect(confirm.getByText('Delete Customer?')).toBeVisible()
    const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/customers\/\d+/.test(r.url()))
    await confirm.getByRole('button', { name: 'Delete Customer', exact: true }).click()
    expect((await removed).status()).toBeLessThan(300)
    await expect.poll(async () => await findByName(name)).toBeNull()
  } finally {
    const left = await findByName(name)
    if (left) await api(`/api/customers/${left.id}`, { method: 'DELETE' })
  }
})

test('customer with transactions: delete asks for a typed confirmation, and cancelling keeps everything', async ({ page }) => {
  const customers = items((await api('/api/customers?page=1&pageSize=100')).json)
  const owing = customers.find((c) => Number(c.balance) > 0)
  expect(owing, 'a customer with a balance must exist').toBeTruthy()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  let deletes = 0
  page.on('request', (r) => { if (r.method() === 'DELETE' && /\/api\/customers\//.test(r.url())) deletes += 1 })
  await openRowMenu(page, owing.name)
  await page.getByRole('menuitem', { name: 'Delete customer' }).click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog.getByText('Force Delete Customer?')).toBeVisible()
  // The destructive button stays disabled until the exact phrase is typed.
  await expect(dialog.getByRole('button', { name: 'Force Delete Everything' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect(deletes, 'nothing was deleted').toBe(0)
  expect((await api(`/api/customers/${owing.id}`)).status).toBe(200)
})
