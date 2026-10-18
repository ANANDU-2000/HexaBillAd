// Payments: add a customer payment through the UI, confirm it through the API, refresh, and void it.
// Each save is checked against the API (persistence), not only a toast. Synthetic local tenant only.
// The amount is unique per run so the test finds its own record.
import { test, expect } from '@playwright/test'
import { ensureOwingCustomer } from './fixtures.js'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'
import { pickValue } from './pickers.js'

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

test('add customer payment -> persisted -> refresh -> void -> kept as a voided record', async ({ page }) => {
  await signIn(page, SLUG)

  // A payment must reference an outstanding invoice (the API refuses on-account payments), so pick a customer with a balance.
  await ensureOwingCustomer(SLUG)
  const customers = items((await api('/api/customers?page=1&pageSize=100')).json)
  const owing = customers.filter((c) => Number(c.balance) > 1).sort((a, b) => Number(b.balance) - Number(a.balance))
  expect(owing.length, 'a customer with an outstanding balance must exist on the local tenant').toBeGreaterThan(0)
  const customer = owing[0]
  // Unique amount: 30-40% of the balance, in cents, varied per run so the test finds its own record.
  const balanceCents = Math.floor(Number(customer.balance) * 100)
  const amount = Math.floor(balanceCents * (0.3 + ((Date.now() % 1000) / 10000))) / 100

  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Payment' }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await pickValue(page, dialog.locator('[name="customerId"]'), customer.id)
  await dialog.locator('input[name="amount"]').fill(amount.toFixed(2))

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/payments$/.test(r.url()))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  const savedRes = await saved
  if (savedRes.status() >= 300) throw new Error(`POST /api/payments ${savedRes.status()}: ${await savedRes.text()}`)
  await expect(dialog).toBeHidden()

  // Persisted: the record exists in the API with the amount and customer entered.
  await expect.poll(async () => items((await api('/api/payments?page=1&pageSize=100')).json)
    .some((p) => Number(p.amount) === amount && p.customerId === customer.id)).toBe(true)
  const created = items((await api('/api/payments?page=1&pageSize=100')).json)
    .find((p) => Number(p.amount) === amount && p.customerId === customer.id)

  // Refresh: the row is still on the page with the saved amount.
  await page.reload({ waitUntil: 'networkidle' })
  const row = page.locator('main').getByText(amount.toFixed(2)).filter({ visible: true }).first()
  await expect(row).toBeVisible()

  // EDIT: lower the amount by 10% and set a reference. The update is confirmed through the API.
  const editedAmount = Math.floor(amount * 90) / 100
  const reference = `UX-EDIT-${Date.now()}`
  // The row for this payment (found by its unique amount): other payments dated today may sit above it.
  const rowFor = (amt) => page.locator('tr, div').filter({ hasText: amt.toFixed(2) }).filter({ has: page.locator('[title="Edit Payment"], [title="Edit"], [aria-label="Void payment"], [title="Void payment"]') }).filter({ visible: true }).last()
  await rowFor(amount).locator('[title="Edit Payment"], [title="Edit"]').filter({ visible: true }).first().click()
  const editDialog = page.getByRole('dialog').first()
  await expect(editDialog).toBeVisible()
  await editDialog.locator('label', { hasText: 'Amount *' }).locator('xpath=following-sibling::input[1]').fill(editedAmount.toFixed(2))
  await editDialog.locator('label', { hasText: 'Reference / Remarks' }).locator('xpath=following-sibling::input[1]').fill(reference)
  const updated = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/payments\//.test(r.url()))
  await editDialog.getByRole('button', { name: 'Save Payment' }).click()
  const updatedRes = await updated
  if (updatedRes.status() >= 300) throw new Error(`PUT /api/payments ${updatedRes.status()}: ${await updatedRes.text()}`)
  await expect(editDialog).toBeHidden()
  await expect.poll(async () => {
    const p = items((await api('/api/payments?page=1&pageSize=100')).json).find((x) => x.id === created.id)
    return p ? [Number(p.amount), p.reference] : null
  }).toEqual([editedAmount, reference])
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('main').getByText(editedAmount.toFixed(2)).filter({ visible: true }).first()).toBeVisible()

  // Void (the list's delete action is a void with a reason, not a hard delete).
  await rowFor(editedAmount).getByRole('button', { name: 'Void payment' }).filter({ visible: true }).first().click()
  const confirm = page.getByRole('dialog').first()
  await expect(confirm).toBeVisible()
  const voided = page.waitForResponse((r) => r.request().method() !== 'GET' && /\/api\/payments\//.test(r.url()))
  await confirm.getByRole('button', { name: /void|confirm|yes/i }).last().click()
  expect((await voided).status()).toBeLessThan(300)
  // A void keeps the record (for the audit trail) and marks it VOID; it is not hard-deleted.
  await expect.poll(async () => {
    const p = items((await api('/api/payments?page=1&pageSize=100')).json).find((x) => x.id === created.id)
    return p ? String(p.status || '').toLowerCase() : 'missing'
  }).toMatch(/void/)
})
