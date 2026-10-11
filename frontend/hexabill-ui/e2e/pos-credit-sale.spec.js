// POS credit sale: a named customer with no payment entered. The stored sale belongs to that customer and is not
// marked paid, and the customer's balance rises by exactly the invoice total. Read back through the API.
// Wide layouts (768px and up). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const PRODUCT = 'gulfharvest Sample Chicken 1kg'

async function api (path) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []
const balanceOf = async (id) => Number((await api(`/api/customers/${id}`)).json.data?.balance)
const money = (t) => Number((String(t).match(/-?[\d,]+\.\d{2}/) || ['NaN'])[0].replace(/,/g, ''))

test('POS credit sale: stored for the customer, unpaid, and the balance rises by the invoice total', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 768, 'phone checkout is a separate flow (not covered here)')
  const customers = items((await api('/api/customers?page=1&pageSize=50')).json)
  const names = customers.map((c) => c.name)
  const customer = customers.find((c) => c.name && names.filter((n) => n === c.name).length === 1 && Number.isFinite(Number(c.balance)))
  expect(customer, 'a customer with a unique name must exist').toBeTruthy()
  const before = await balanceOf(customer.id)

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  const search = page.getByPlaceholder(/^Customer/).filter({ visible: true }).first()
  await search.click()
  await search.fill(customer.name)
  await page.getByText(customer.name, { exact: true }).filter({ visible: true }).last().click()

  await page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true }).first().click()
  await page.getByRole('button').filter({ hasText: PRODUCT }).filter({ visible: true }).first().click()
  const totalLabel = page.getByText('Grand Total').filter({ visible: true }).first()
  const shown = money(await totalLabel.locator('xpath=..').innerText())
  expect(shown).toBeGreaterThan(0)

  // A fresh POS starts on Cash (PS-04), so choose Credit Invoice on purpose.
  await page.locator('select').filter({ has: page.locator('option[value="Pending"]') }).filter({ visible: true }).first().selectOption('Pending')
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
  await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
  const res = await saved
  const body = await res.json().catch(() => ({}))
  if (res.status() >= 300) throw new Error(`POST /api/sales ${res.status()}: ${JSON.stringify(body).slice(0, 300)}`)
  const id = body.data?.id ?? body.data?.Id
  const stored = (await api(`/api/sales/${id}`)).json.data || {}
  expect(stored.customerId, 'the sale belongs to the chosen customer').toBe(customer.id)
  expect(Number(stored.grandTotal)).toBeCloseTo(shown, 2)
  expect(String(stored.paymentStatus).toLowerCase(), 'no payment entered, so not paid').not.toBe('paid')
  expect(Number(stored.paidAmount ?? 0)).toBeCloseTo(0, 2)
  await expect.poll(() => balanceOf(customer.id)).toBeCloseTo(before + shown, 2)
})
