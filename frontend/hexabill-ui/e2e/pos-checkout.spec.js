// POS checkout: add a product, check out in cash, and confirm the saved sale through the API.
// The grand total on the payment sheet must equal the total the server stored. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const PRODUCT = process.env.HEXABILL_E2E_PRODUCT || 'gulfharvest Sample Chicken 1kg'

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

const money = (text) => {
  const m = String(text).match(/-?[\d,]+\.\d{2}/g)
  return m ? Number(m[m.length - 1].replace(/,/g, '')) : NaN
}

test('POS checkout: the sale is saved, the total matches the server, and the saved invoice is readable', async ({ page }, info) => {
  void info
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })

  // The product drawer opens from "Add Row" (wide layouts) or "Add Product to Bill" (phones); pick whichever is on screen.
  const addRow = page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true })
  const addToBill = page.getByRole('button', { name: 'Add Product to Bill', exact: true }).filter({ visible: true })
  const wideLayout = (await addRow.count()) > 0
  await (wideLayout ? addRow : addToBill).first().click()
  await page.getByRole('button').filter({ hasText: PRODUCT }).filter({ visible: true }).first().click()

  // The grand total shown to the cashier.
  const totalLabel = page.getByText('Grand Total').filter({ visible: true }).first()
  await expect(totalLabel).toBeVisible()
  const shownTotal = money(await totalLabel.locator('xpath=..').innerText())
  expect(shownTotal).toBeGreaterThan(0)

  // Save the invoice. Wide layouts: "Save Invoice". Phones: Checkout opens the payment sheet, then "Save & Generate Invoice".
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
  if (wideLayout) {
    await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
  } else {
    await page.getByRole('button', { name: /^Checkout$/ }).filter({ visible: true }).first().click()
    await page.getByRole('button', { name: /Save & Generate Invoice/ }).filter({ visible: true }).first().click()
  }
  const res = await saved
  const body = await res.json().catch(() => ({}))
  if (res.status() >= 300) throw new Error(`POST /api/sales ${res.status()}: ${JSON.stringify(body).slice(0, 300)}`)
  const sale = body.data || {}
  const saleId = sale.id ?? sale.Id
  expect(saleId, 'the server returns the new sale id').toBeTruthy()

  // Read back through the API: the stored total is the total the cashier saw.
  const stored = (await api(`/api/sales/${saleId}`)).json.data || {}
  const storedTotal = Number(stored.grandTotal ?? stored.totalAmount ?? stored.GrandTotal ?? NaN)
  expect(storedTotal).toBeCloseTo(shownTotal, 2)
})
