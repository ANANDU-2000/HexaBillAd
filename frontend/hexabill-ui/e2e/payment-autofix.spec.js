import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'
import { pickValue } from './pickers.js'
import { createOwingCustomer } from './fixtures.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function authHeaders () {
  const s = await apiLogin(SLUG)
  return { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' }
}
async function api (path) {
  const r = await fetch(`${API}${path}`, { headers: await authHeaders() })
  return r.json().catch(() => ({}))
}
const items = (json) => json.data?.items || json.data || []
const paymentCount = async (customerId, amount) =>
  items(await api('/api/payments?page=1&pageSize=100')).filter(p => Number(p.amount) === amount && p.customerId === customerId).length

// A fresh customer with its own stocked product and one credit invoice, so the payment has something to settle
// and no other test's data (stock, balances) can affect it.
async function owingCustomer () {
  const customer = await createOwingCustomer(SLUG)
  const fresh = (await api(`/api/customers/${customer.id}`)).data
  expect(Number(fresh.balance), 'customer owes after the credit sale').toBeGreaterThan(50)
  return fresh
}

async function openForm (page, customer) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Payment' }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await pickValue(page, dialog.locator('[name="customerId"]'), customer.id)
  return dialog
}

test('an amount with extra decimals is rounded and recorded once', async ({ page }) => {
  const customer = await owingCustomer()
  const dialog = await openForm(page, customer)
  const cents = 1000 + (Date.now() % 800)
  const typed = `${(cents / 100).toFixed(2)}7`
  const expected = Math.round(Number(typed) * 100) / 100
  await dialog.locator('input[name="amount"]').fill(typed)
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/payments$/.test(r.url()))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  const res = await saved
  expect(res.status()).toBeLessThan(300)
  expect(res.request().postDataJSON().amount).toBe(expected)
  await expect.poll(() => paymentCount(customer.id, expected)).toBe(1)
})

test('a missing amount and a too large amount say exactly what to type', async ({ page }) => {
  const customer = await owingCustomer()
  const dialog = await openForm(page, customer)
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  await expect(dialog.getByText('Type the amount received, for example 250.00')).toBeVisible()
  const tooMuch = Math.ceil(Number(customer.balance)) + 500
  await dialog.locator('input[name="amount"]').fill(String(tooMuch))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  await expect(page.getByText(/is more than the customer owes/).first()).toBeVisible()
  await expect(dialog).toBeVisible()
})

test('a lost server answer never records the payment twice', async ({ page }) => {
  const customer = await owingCustomer()
  const dialog = await openForm(page, customer)
  const amount = (2000 + (Date.now() % 800)) / 100
  let posts = 0
  await page.route(/\/api\/payments$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    if (posts > 1) return route.continue()
    // The server really records it; only the answer is lost.
    await route.fetch({
      url: `${API}/api/payments`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await dialog.locator('input[name="amount"]').fill(amount.toFixed(2))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  // The page confirms the unconfirmed payment with the server (same idempotency key) and clears its warning.
  await expect(page.getByText(/is unconfirmed/)).toHaveCount(0, { timeout: 20000 })
  await expect.poll(() => paymentCount(customer.id, amount), { timeout: 15000 }).toBe(1)
  expect(posts).toBeLessThanOrEqual(2)
})
