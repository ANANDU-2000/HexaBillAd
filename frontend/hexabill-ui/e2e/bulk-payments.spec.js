// Bulk payments on the Payments page: two customers saved in one batch, confirmed through the API;
// a row without a customer is refused before anything is sent; a failed row retried later creates no duplicates.
// Synthetic local tenant only. Amounts are unique per run.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'
import { pickValue } from './pickers.js'
import { createPlainCustomer, ensureOwingCustomers } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

// Two customers who owe enough to take a payment of about 10-100 AED (created through the API if missing).
async function owingCustomers () {
  const owing = await ensureOwingCustomers(SLUG, 2)
  return [owing[0], owing[1]]
}

async function openBulk (page) {
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Bulk Payment', exact: true }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Bulk Payment Entry' }).first()
  await expect(dialog).toBeVisible()
  return dialog
}

// Customer selects are the ones with an empty "Select Customer" option; amounts are the number inputs in order.
// The Customer field is a native <select> on short lists and a searchable combobox on long ones; pickValue handles both.
const pickCustomer = (page, dialog, index, id) => pickValue(page, dialog.getByLabel('Customer', { exact: true }).nth(index), id)
const amountInput = (dialog, index) => dialog.locator('input[type="number"]').nth(index)

test('bulk payments: two customers saved together, confirmed through the API', async ({ page }) => {
  await signIn(page, SLUG)
  const [a, b] = await owingCustomers()
  // Small amounts (10-21 AED) so repeated runs do not use up the local balances.
  const amountA = Number((((Date.now() % 1000) + 1000) / 100).toFixed(2))
  const amountB = Number((amountA + 0.37).toFixed(2))

  const dialog = await openBulk(page)
  await pickCustomer(page, dialog, 0, a.id)
  await amountInput(dialog, 0).fill(amountA.toFixed(2))
  await dialog.getByRole('button', { name: 'Add Another Payment' }).click()
  await pickCustomer(page, dialog, 1, b.id)
  await amountInput(dialog, 1).fill(amountB.toFixed(2))

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/payments$/.test(r.url()))
  await dialog.getByRole('button', { name: /Save All Payments \(2\)/ }).click()
  expect((await saved).status()).toBeLessThan(300)
  await expect(dialog).toBeHidden()

  // Confirmed through the API: one payment per row, for the right customer and amount.
  await expect.poll(async () => {
    const list = items((await api('/api/payments?page=1&pageSize=100')).json)
    return [
      list.filter((p) => Number(p.amount) === amountA && p.customerId === a.id).length,
      list.filter((p) => Number(p.amount) === amountB && p.customerId === b.id).length,
    ]
  }).toEqual([1, 1])

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('main').getByText(amountA.toFixed(2)).filter({ visible: true }).first()).toBeVisible()
})

test('bulk payments: a row without a customer is refused before anything is saved', async ({ page }) => {
  await signIn(page, SLUG)
  const [a] = await owingCustomers()
  const amount = Number((((Date.now() % 3000) + 500) / 100).toFixed(2))
  const before = items((await api('/api/payments?page=1&pageSize=100')).json).length

  const dialog = await openBulk(page)
  await amountInput(dialog, 0).fill(amount.toFixed(2))
  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/payments$/.test(r.url())) posts += 1 })
  await dialog.getByRole('button', { name: /Save All Payments \(1\)/ }).click()
  await expect(page.getByText('Select a customer for every bulk payment.').filter({ visible: true }).first()).toBeVisible()
  expect(posts).toBe(0)
  void a
  expect(items((await api('/api/payments?page=1&pageSize=100')).json).length).toBe(before)
  await expect(dialog).toBeVisible()
})

test('bulk payments: a failed row pauses, then resumes without duplicating the rows that succeeded', async ({ page }) => {
  await signIn(page, SLUG)
  const [a, b] = await owingCustomers()
  const amountA = Number((((Date.now() % 1000) + 1000) / 100).toFixed(2))
  const amountB = Number((amountA + 0.53).toFixed(2))

  // Fail the second row's requests (including the client's own keyed retries) until the test releases them.
  let failing = true
  await page.route((url) => url.pathname.endsWith('/api/payments'), async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const body = route.request().postDataJSON()
    if (failing && Number(body.amount) === amountB) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary failure' }) })
    }
    return route.continue()
  })

  const dialog = await openBulk(page)
  await pickCustomer(page, dialog, 0, a.id)
  await amountInput(dialog, 0).fill(amountA.toFixed(2))
  await dialog.getByRole('button', { name: 'Add Another Payment' }).click()
  await pickCustomer(page, dialog, 1, b.id)
  await amountInput(dialog, 1).fill(amountB.toFixed(2))
  await dialog.getByRole('button', { name: /Save All Payments \(2\)/ }).click()

  // The batch pauses: the failed row is kept and the retry is offered (enabled, not still in flight).
  const retry = dialog.getByRole('button', { name: /Retry remaining payments \(1\)/ })
  await expect(retry).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByText(/Saved bulk payments: 1 of 2 confirmed/).filter({ visible: true }).first()).toBeVisible()

  // Release the failure and resume the saved batch.
  failing = false
  await retry.click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  // Exactly one payment per row in the API, even though row 1 was sent before the failure.
  await expect.poll(async () => {
    const list = items((await api('/api/payments?page=1&pageSize=100')).json)
    return [
      list.filter((p) => Number(p.amount) === amountA && p.customerId === a.id).length,
      list.filter((p) => Number(p.amount) === amountB && p.customerId === b.id).length,
    ]
  }).toEqual([1, 1])
})

test('bulk payments: a payment the server refuses is handed back to fix, with no stuck banners', async ({ page }) => {
  await signIn(page, SLUG)
  const [a] = await owingCustomers()
  const nothingOwed = await createPlainCustomer(SLUG) // no invoices: the server answers 400 "no outstanding invoices" and saves nothing for that key
  const amountA = Number((((Date.now() % 1000) + 1000) / 100).toFixed(2))

  const dialog = await openBulk(page)
  await pickCustomer(page, dialog, 0, a.id)
  await amountInput(dialog, 0).fill(amountA.toFixed(2))
  await dialog.getByRole('button', { name: 'Add Another Payment' }).click()
  await pickCustomer(page, dialog, 1, nothingOwed.id)
  await amountInput(dialog, 1).fill('25')
  await dialog.getByRole('button', { name: /Save All Payments \(2\)/ }).click()

  // The refused row comes back in the form with the server's reason; the first payment stays confirmed; nothing is "waiting for confirmation".
  await expect(dialog.getByRole('alert').filter({ hasText: /outstanding invoices/i }).first()).toBeVisible({ timeout: 20_000 })
  await expect(dialog.getByRole('button', { name: /Save All Payments \(1\)/ })).toBeEnabled()
  await expect(page.getByText(/Saved bulk payments/)).toHaveCount(0)
  await expect(page.getByText(/is unconfirmed/)).toHaveCount(0)
  await expect(amountInput(dialog, 0)).toHaveValue('25')
  await expect(amountInput(dialog, 0)).toBeEnabled()
  await expect.poll(async () => {
    const list = items((await api('/api/payments?page=1&pageSize=100')).json)
    return list.filter((p) => Number(p.amount) === amountA && p.customerId === a.id).length
  }).toBe(1)

  // Swap in a customer who owes money and save again: it goes through as a new payment.
  const [, b] = await owingCustomers()
  const amountB = Number((amountA + 0.71).toFixed(2))
  await pickCustomer(page, dialog, 0, b.id)
  await amountInput(dialog, 0).fill(amountB.toFixed(2))
  await dialog.getByRole('button', { name: /Save All Payments \(1\)/ }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await expect.poll(async () => {
    const list = items((await api('/api/payments?page=1&pageSize=100')).json)
    return list.filter((p) => Number(p.amount) === amountB && p.customerId === b.id).length
  }).toBe(1)
})
