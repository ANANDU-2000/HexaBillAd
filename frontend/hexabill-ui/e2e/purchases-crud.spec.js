// Purchases create -> persisted -> refresh -> edit -> persisted -> delete -> gone, through the UI.
// Each step is confirmed against the API (persistence), not only a toast. Desktop (1280px+) only:
// the mobile purchase form is a separate checkpoint. Synthetic local tenant only.
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
  const items = json.data?.items || []
  return items.find((p) => p.invoiceNo === invoice) || null
}

// The legacy purchase form does not link labels to inputs, so inputs are found by the label's sibling.
const fieldAfter = (page, label) => page.locator('label', { hasText: label }).first().locator('xpath=following-sibling::input[1]')
// Desktop item row of the purchase form: number inputs in order, qty first, then unit cost.
const itemInput = (page, index) => page.locator('table tbody tr').filter({ has: page.locator('input[type="number"]') }).first()
  .locator('input[type="number"]').nth(index)

test('purchase create -> persisted -> edit totals -> persisted -> delete -> gone', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 1280, 'Desktop form; mobile form is a separate checkpoint')
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
  await page.getByText(product.nameEn, { exact: true }).first().click()
  await itemInput(page, 0).fill('5')
  await itemInput(page, 1).fill('20')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/purchases$/.test(r.url()))
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  expect((await created).status()).toBeLessThan(300)

  // Persisted: read back through the API. 5 x 20 = 100 subtotal, 5% VAT = 105 total.
  await expect.poll(async () => (await purchaseByInvoice(INVOICE))?.totalAmount).toBeCloseTo(105, 2)
  const saved = await purchaseByInvoice(INVOICE)
  expect(saved.supplierName).toBe(SUPPLIER)

  // REFRESH: the row is still there with the saved total.
  await page.reload({ waitUntil: 'networkidle' })
  const row = page.locator('main tbody tr').filter({ hasText: INVOICE }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('105.00')

  // EDIT qty 5 -> 6: subtotal 120, total 126.
  await page.getByRole('button', { name: `More actions for ${INVOICE}` }).click()
  await page.getByRole('menuitem', { name: 'Edit purchase' }).click()
  await expect(page.getByText('Edit Purchase Entry')).toBeVisible()
  await itemInput(page, 0).fill('6')
  const updated = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/purchases\//.test(r.url()))
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  expect((await updated).status()).toBeLessThan(300)
  await expect.poll(async () => (await purchaseByInvoice(INVOICE))?.totalAmount).toBeCloseTo(126, 2)

  // Refresh again: the edited total is what the list shows.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('main tbody tr').filter({ hasText: INVOICE }).first()).toContainText('126.00')

  // DELETE (confirmation required)
  await page.getByRole('button', { name: `More actions for ${INVOICE}` }).click()
  await page.getByRole('menuitem', { name: 'Delete purchase' }).click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /delete|confirm/i }).last().click()
  await expect.poll(async () => purchaseByInvoice(INVOICE)).toBeNull()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('main tbody tr').filter({ hasText: INVOICE })).toHaveCount(0)
})

// Pay supplier on a purchase row opens the supplier ledger payment with the amount filled. Saving it
// must persist a supplier payment and reduce what is owed to that supplier (read back through the API).
// Payments are applied to the oldest bills first, so the check is on the supplier balance, not one invoice.
test('Pay supplier from a purchase row records a payment that reduces the supplier balance', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 1280, 'Desktop row action; mobile payment is a separate checkpoint')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })

  const payRow = page.locator('main tbody tr').filter({ has: page.getByRole('button', { name: 'Pay supplier' }) }).first()
  await expect(payRow).toBeVisible()
  const supplier = (await payRow.locator('td').nth(1).innerText()).trim()
  const balanceOf = async () => {
    const { json } = await api(`/api/suppliers/balance/${encodeURIComponent(supplier)}`)
    return Number((json.data ?? json).netPayable)
  }
  const before = await balanceOf()
  expect(before).toBeGreaterThan(0)

  await payRow.getByRole('button', { name: 'Pay supplier' }).click()
  await expect(page).toHaveURL(/recordPayment=1/)
  const amountField = page.locator('label', { hasText: 'Amount *' }).first().locator('xpath=following-sibling::input[1]')
  await expect(amountField).not.toHaveValue('')
  const amount = Number(await amountField.inputValue())
  expect(amount).toBeGreaterThan(0)

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/payments$/.test(r.url()))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await saved).status()).toBeLessThan(300)
  await expect.poll(balanceOf).toBeCloseTo(before - amount, 2)
})
