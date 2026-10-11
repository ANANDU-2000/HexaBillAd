// Payments: a cheque stays pending until it is cleared. Pending must not reduce the customer's balance; clearing must
// reduce it by exactly the cheque amount; voiding the cleared cheque gives the balance back. Checked through the API.
// Runs on every width (table row from 768px, card on phones). Synthetic local tenant only; the cheque is voided at the end.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []
const balanceOf = async (id) => Number((await api(`/api/customers/${id}`)).json.data?.balance)
const paymentById = async (id) => items((await api('/api/payments?page=1&pageSize=200')).json).find((p) => p.id === id)

test('cheque: pending keeps the balance, cleared reduces it by the amount, void restores it', async ({ page }) => {
  await signIn(page, SLUG)
  const customers = items((await api('/api/customers?page=1&pageSize=50')).json)
  const customer = customers.filter((c) => Number(c.balance) > 60).sort((a, b) => Number(b.balance) - Number(a.balance))[0]
  expect(customer, 'a customer with a balance above 60 must exist').toBeTruthy()
  const start = await balanceOf(customer.id)
  const amount = 11 + (Date.now() % 900) / 100 // 11.00 to 19.99, unique enough to find the record
  const reference = `UX-CHQ-${Date.now()}`

  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Payment' }).first().click()
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('select[name="customerId"]').selectOption({ value: String(customer.id) })
  await dialog.locator('select[name="method"]').selectOption({ label: 'Cheque' })
  await dialog.locator('input[name="amount"]').fill(amount.toFixed(2))
  await dialog.locator('input[name="ref"], input[name="reference"]').first().fill(reference)
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/payments$/.test(r.url()))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  const res = await saved
  if (res.status() >= 300) throw new Error(`POST /api/payments ${res.status()}: ${await res.text()}`)
  await expect(dialog).toBeHidden()

  let created
  await expect.poll(async () => {
    created = items((await api('/api/payments?page=1&pageSize=200')).json).find((p) => p.reference === reference)
    return Boolean(created)
  }).toBe(true)
  try {
    // Pending: recorded as a cheque, not counted against the balance yet.
    expect(String(created.status).toUpperCase(), 'new cheque is not cleared').not.toBe('CLEARED')
    expect(await balanceOf(customer.id), 'a pending cheque does not change the balance').toBeCloseTo(start, 2)

    // Clear it from the row.
    await page.reload({ waitUntil: 'networkidle' })
    // The smallest element that holds this reference and a Mark cleared button: a table row or a phone card.
    const row = page.locator('tr, div').filter({ hasText: reference }).filter({ has: page.getByRole('button', { name: 'Mark cleared' }) }).last()
    const cleared = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/payments\/\d+\/status$/.test(r.url()))
    await row.getByRole('button', { name: 'Mark cleared' }).filter({ visible: true }).first().click()
    expect((await cleared).status()).toBeLessThan(300)
    await expect.poll(async () => String((await paymentById(created.id))?.status).toUpperCase()).toBe('CLEARED')
    await expect.poll(() => balanceOf(customer.id)).toBeCloseTo(start - Number(amount.toFixed(2)), 2)
  } finally {
    // Void the cheque (through the API, as the owner) so the balance returns to where it started.
    await api(`/api/payments/${created.id}`, { method: 'DELETE' })
  }
  await expect.poll(() => balanceOf(customer.id)).toBeCloseTo(start, 2)
})
