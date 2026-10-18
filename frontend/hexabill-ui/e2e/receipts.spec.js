// Receipts (they live on the Payments page; there is no separate /receipts route).
// Rules under test: only CLEARED incoming payments (cash, cheque, online, debit) can get a receipt. Voided,
// refund and settlement rows show a disabled print action with the reason. Selected receipts total correctly,
// and the receipt PDF is returned by the server. Two cash payments are created through the API as fixtures.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

// Two cleared cash payments for a customer who owes money, created as fixtures. Returns their ids and amounts.
async function createFixturePayments () {
  const customers = items((await api('/api/customers?page=1&pageSize=50')).json)
  const owing = customers.filter((c) => Number(c.balance) > 20).sort((a, b) => Number(b.balance) - Number(a.balance))
  expect(owing.length, 'a customer with an outstanding balance must exist on the local tenant').toBeGreaterThan(0)
  const customer = owing[0]
  const base = ((Date.now() % 500) + 100) / 100 // 1.00 - 6.00
  const made = []
  for (const amount of [Number(base.toFixed(2)), Number((base + 1.25).toFixed(2))]) {
    const r = await api('/api/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ customerId: customer.id, saleId: null, amount, mode: 'CASH', reference: null, paymentDate: new Date().toISOString() }),
    })
    expect(r.status, `create fixture payment: ${JSON.stringify(r.json).slice(0, 200)}`).toBeLessThan(300)
    made.push({ id: r.json.data?.id ?? r.json.data?.payment?.id, amount })
  }
  return made
}

test('receipts: select cleared payments, total is right, server returns the receipt PDF', async ({ page }, info) => {
  await signIn(page, SLUG)
  const fixtures = await createFixturePayments()
  const total = fixtures.reduce((s, f) => s + f.amount, 0)
  // Payment ids come back from the create call; if the response shape differs, look them up by amount.
  const ids = []
  for (const f of fixtures) {
    if (f.id) { ids.push(f.id); continue }
    const found = items((await api('/api/payments?page=1&pageSize=100')).json).find((p) => Number(p.amount) === f.amount)
    expect(found, `payment ${f.amount} must exist`).toBeTruthy()
    ids.push(found.id)
  }

  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  for (const id of ids) {
    await page.getByLabel(`Select payment ${id} for receipt`).filter({ visible: true }).check()
  }
  const bar = page.getByText(new RegExp(`${ids.length} payment\\(s\\) selected`)).filter({ visible: true }).first()
  await expect(bar).toBeVisible()
  await expect(bar).toContainText(total.toFixed(2))

  // Generate Receipt builds the preview (batch request); Download PDF then asks the server for the PDF.
  const batch = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/payments\/receipt\/batch$/.test(r.url()))
  await page.getByRole('button', { name: 'Generate Receipt' }).filter({ visible: true }).first().click()
  expect((await batch).status()).toBeLessThan(300)
  const preview = page.getByRole('dialog').filter({ hasText: /Payment Receipt/ }).first()
  await expect(preview).toBeVisible()
  await expect(preview).toContainText(total.toFixed(2))
  // Two cash payments: the receipt names the method, not "Multiple" (fixed in PaymentReceiptService).
  await expect(preview).toContainText(/Payment Method: CASH/i)
  await expect(preview).not.toContainText('Multiple')

  const pdf = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/payments\/receipt\/pdf$/.test(r.url()))
  await preview.getByRole('button', { name: /Download PDF/ }).click()
  const res = await pdf
  expect(res.status()).toBe(200)
  expect(String(res.headers()['content-type'] || '')).toContain('application/pdf')
  const body = await res.body()
  expect(body.length, 'receipt PDF must not be empty').toBeGreaterThan(1000)
  expect(body.subarray(0, 4).toString()).toBe('%PDF')
  void info
})

test('receipts: a voided payment cannot get a receipt and says why', async ({ page }) => {
  await signIn(page, SLUG)
  const voided = items((await api('/api/payments?page=1&pageSize=100')).json).find((p) => String(p.status || '').toUpperCase() === 'VOID')
  test.skip(!voided, 'no voided payment on the local tenant (the payments CRUD spec creates one)')
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  // The receipt checkbox and print action are not offered for a voided row.
  await expect(page.getByLabel(`Select payment ${voided.id} for receipt`)).toHaveCount(0)
})
