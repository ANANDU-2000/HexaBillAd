// Purchases create -> persisted -> refresh -> edit -> persisted -> delete -> gone, through the UI,
// plus pay supplier from a purchase. Each save is confirmed against the API (persistence), not only a toast.
// Viewport-aware: the item form is a table from 768px (md) and a card list below it; the purchase list
// is a table from 1280px (xl) and expandable rows below it. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const SUPPLIER = 'UX Audit Supplier Al Noor Trading'
const INVOICE = `UX-CRUD-${Date.now()}`

async function api (path) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function purchaseByInvoice (invoice) {
  const { json } = await api('/api/purchases?page=1&pageSize=100')
  return (json.data?.items || []).find((p) => p.invoiceNo === invoice) || null
}

// The legacy purchase form does not link labels to inputs, so inputs are found by the label's sibling.
const fieldAfter = (page, label) => page.locator('label', { hasText: label }).filter({ visible: true }).first()
  .locator('xpath=following-sibling::input[1]')

test('purchase create -> persisted -> edit totals -> persisted -> delete -> gone', async ({ page }, info) => {
  const width = info.project.use.viewport.width
  const formIsTable = width >= 768
  const listIsTable = width >= 1280

  // Item quantity and unit cost: desktop item table at md+, card labels below.
  const itemRow = () => page.locator('table tbody tr').filter({ has: page.locator('input[type="number"]') }).first()
  const qtyInput = () => (formIsTable ? itemRow().locator('input[type="number"]').nth(0) : fieldAfter(page, 'Qty'))
  const costInput = () => (formIsTable ? itemRow().locator('input[type="number"]').nth(1) : fieldAfter(page, 'Unit cost'))

  // A row for this invoice: a table row at xl+, an expandable card below.
  const rowFor = (invoice) => (listIsTable
    ? page.locator('main tbody tr').filter({ hasText: invoice }).first()
    : page.locator('main button[aria-expanded]').filter({ hasText: invoice }).first())

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })

  // Product used on the purchase (the local tenant has one active product).
  const products = await api('/api/products?page=1&pageSize=20')
  const product = (products.json.data?.items || products.json.data || [])[0]
  expect(product, 'a product must exist on the local tenant').toBeTruthy()

  // CREATE
  await page.getByRole('button', { name: /^New Purchase$/ }).click()
  await expect(page.getByText('New Purchase Entry')).toBeVisible()
  await fieldAfter(page, 'Supplier Name').fill(SUPPLIER)
  await fieldAfter(page, 'Invoice No').fill(INVOICE)
  await page.getByPlaceholder('Search products...').fill(product.nameEn)
  await page.getByText(product.nameEn, { exact: true }).filter({ visible: true }).first().click()
  await qtyInput().fill('5')
  await costInput().fill('20')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/purchases$/.test(r.url()))
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  expect((await created).status()).toBeLessThan(300)

  // Persisted: read back through the API. 5 x 20 = 100 subtotal, 5% VAT = 105 total.
  await expect.poll(async () => (await purchaseByInvoice(INVOICE))?.totalAmount).toBeCloseTo(105, 2)
  expect((await purchaseByInvoice(INVOICE)).supplierName).toBe(SUPPLIER)

  // REFRESH: the row is still there with the saved total.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(rowFor(INVOICE)).toBeVisible()
  await expect(rowFor(INVOICE)).toContainText('105.00')

  // EDIT qty 5 -> 6: subtotal 120, total 126.
  if (listIsTable) {
    await page.getByRole('button', { name: `More actions for ${INVOICE}` }).click()
    await page.getByRole('menuitem', { name: 'Edit purchase' }).click()
  } else {
    await rowFor(INVOICE).click()
    await rowFor(INVOICE).locator('xpath=..').getByRole('button', { name: 'Edit', exact: true }).click()
  }
  await expect(page.getByText('Edit Purchase Entry')).toBeVisible()
  await qtyInput().fill('6')
  const updated = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/purchases\//.test(r.url()))
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  expect((await updated).status()).toBeLessThan(300)
  await expect.poll(async () => (await purchaseByInvoice(INVOICE))?.totalAmount).toBeCloseTo(126, 2)

  // Refresh again: the edited total is what the list shows.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(rowFor(INVOICE)).toContainText('126.00')

  // DELETE (confirmation required)
  if (listIsTable) {
    await page.getByRole('button', { name: `More actions for ${INVOICE}` }).click()
    await page.getByRole('menuitem', { name: 'Delete purchase' }).click()
  } else {
    await rowFor(INVOICE).click()
    await rowFor(INVOICE).locator('xpath=..').getByRole('button', { name: 'Delete', exact: true }).click()
  }
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /delete|confirm/i }).last().click()
  await expect.poll(async () => purchaseByInvoice(INVOICE)).toBeNull()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(rowFor(INVOICE)).toHaveCount(0)
})

// Pay supplier from an unpaid purchase opens the supplier ledger payment with the amount filled.
// Saving must persist a supplier payment and reduce what is owed to that supplier (read back through the API).
// Payments are applied to the oldest bills first, so the check is on the supplier balance, not one invoice.
test('pay supplier from a purchase records a payment that reduces the supplier balance', async ({ page }, info) => {
  const listIsTable = info.project.use.viewport.width >= 1280
  await signIn(page, SLUG)

  const { json } = await api('/api/purchases?page=1&pageSize=50')
  const target = (json.data?.items || []).find((p) => Number(p.balanceAmount ?? p.totalAmount) > 0.009 && (p.paymentStatus || '').toLowerCase() !== 'paid')
  expect(target, 'an unpaid purchase must exist on the local tenant').toBeTruthy()
  const supplier = target.supplierName
  const balanceOf = async () => {
    const { json: b } = await api(`/api/suppliers/balance/${encodeURIComponent(supplier)}`)
    return Number((b.data ?? b).netPayable)
  }
  const before = await balanceOf()
  expect(before).toBeGreaterThan(0)

  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  let payButton
  if (listIsTable) {
    payButton = page.locator('main tbody tr').filter({ hasText: target.invoiceNo }).first().getByRole('button', { name: 'Pay supplier' })
  } else {
    const row = page.locator('main button[aria-expanded]').filter({ hasText: target.invoiceNo }).first()
    await row.click()
    payButton = row.locator('xpath=..').getByRole('button', { name: 'Pay supplier' })
  }
  await expect(payButton).toBeVisible()
  await payButton.click()

  // PU-12: the amount and reference are not in the URL.
  await expect(page).not.toHaveURL(/amount=|ref=|recordPayment/)
  const amountField = page.locator('label', { hasText: 'Amount *' }).first().locator('xpath=following-sibling::input[1]')
  await expect(amountField).not.toHaveValue('')
  const amount = Number(await amountField.inputValue())
  expect(amount).toBeGreaterThan(0)

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/payments$/.test(r.url()))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await saved).status()).toBeLessThan(300)
  await expect.poll(balanceOf).toBeCloseTo(before - amount, 2)
})
