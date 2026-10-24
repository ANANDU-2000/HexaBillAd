// FrozenHub 1 invoice numbering: the owner sets "New invoice numbers start at" 7000 in Settings, POS offers 7000,
// typed numbers are editable but cannot use the earlier (Starplus) range or an already issued/deleted number, and
// the start cannot be removed once used. Synthetic local tenant only; run with --project=d1440 (it changes settings).
import { test, expect } from '@playwright/test'
import { apiLogin, signIn, feOrigin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'frozenhub1-test'

async function raw (urlPath, method = 'GET', body) {
  const { token } = await apiLogin(SLUG)
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function call (urlPath, method, body) {
  const r = await raw(urlPath, method, body)
  if (r.status >= 300) throw new Error(`${method} ${urlPath}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)
  return r.json.data
}

test('owner sets 7000; POS offers it; typed numbers are checked; start cannot be removed once used', async ({ page }) => {
  test.skip(page.viewportSize().width < 1024, 'settings-changing flow runs once, on desktop')
  const stamp = `${Date.now()}`
  const product = await call('/api/products', 'POST', { sku: `NUM-${stamp}`, nameEn: `NUMBER QA ${stamp}`, unitType: 'CRTN', conversionToBase: 1, costPrice: 5, sellPrice: 10, stockQty: 0 })
  await call('/api/purchases', 'POST', { supplierName: `NUM stock ${stamp}`, invoiceNo: `NUM-S-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash', items: [{ productId: product.id, unitType: 'CRTN', qty: 20, unitCost: 5 }] })
  const customer = await call('/api/customers', 'POST', { name: `Numbering QA ${stamp}`, phone: `058${stamp.slice(-7)}`, creditLimit: 1000, customerType: 'Credit' })
  const sale = (invoiceNo, ref) => raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `num-${ref}-${stamp}`, ...(invoiceNo ? { invoiceNo } : {}), items: [{ productId: product.id, unitType: 'CRTN', qty: 1, unitPrice: 10 }] })

  // 1. Owner sets the start in Settings → Billing.
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/settings`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Billing' }).or(page.getByRole('button', { name: 'Billing', exact: true })).first().click()
  const start = page.getByLabel('New invoice numbers start at')
  await expect(start).toBeVisible()
  await start.fill('7000')
  const saved = page.waitForResponse((r) => r.url().includes('/api/settings') && r.request().method() === 'PUT')
  await page.getByRole('button', { name: /Save Changes|Save Settings/ }).first().click()
  expect((await saved).status()).toBe(200)
  expect((await call('/api/settings')).INVOICE_SERIES_START).toBe('7000')
  await page.screenshot({ path: test.info().outputPath('settings-7000.png') })

  // 2. POS offers 7000 in the editable invoice number box.
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  await expect(page.getByLabel('Invoice number')).toHaveValue('7000')
  await page.screenshot({ path: test.info().outputPath('pos-7000.png') })

  // 3. Saving without typing uses 7000; typed numbers are validated with clear reasons.
  const first = await sale(null, 'a')
  expect(first.status).toBe(201)
  expect(first.json.data.invoiceNo).toBe('7000')
  const starplus = await sale('6500', 'b')
  expect(starplus.status).toBe(400)
  expect(starplus.json.message).toContain('below 7000')
  const typed = await sale('7005', 'c')
  expect(typed.status).toBe(201)
  expect(typed.json.data.invoiceNo).toBe('7005')
  expect((await call(`/api/sales/${typed.json.data.id}`, 'DELETE')) ?? true).toBeTruthy()
  const reused = await sale('7005', 'd')
  expect(reused.status).toBe(400)
  expect(reused.json.message).toContain('already issued')
  const next = await sale(null, 'e')
  expect(next.json.data.invoiceNo).toBe('7006')
  const check = await raw('/api/sales/validate-invoice-number', 'POST', { invoiceNumber: '6999' })
  expect(check.json.data).toBe(false)
  expect(check.json.message).toContain('below 7000')

  // 4. The start cannot be removed once invoices were issued from it.
  await page.goto(`${feOrigin(SLUG)}/settings`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Billing' }).or(page.getByRole('button', { name: 'Billing', exact: true })).first().click()
  await expect(page.getByLabel('New invoice numbers start at')).toHaveValue('7000')
  await page.getByLabel('New invoice numbers start at').fill('')
  const clearRequest = page.waitForRequest((r) => r.url().includes('/api/settings') && r.method() === 'PUT')
  await page.getByRole('button', { name: /Save Changes|Save Settings/ }).first().click()
  const body = JSON.parse((await clearRequest).postData() || '{}')
  expect(body.INVOICE_SERIES_START, `PUT body keys: ${Object.keys(body).join(',')}`).toBe('')
  await expect(page.getByText(/cannot be removed/i).first()).toBeVisible()
  expect((await call('/api/settings')).INVOICE_SERIES_START).toBe('7000')
})
