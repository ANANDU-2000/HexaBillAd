// E2E-G1 / J2: POS cash sale. Customer -> 3 items (one by barcode) -> discount -> Cash -> Save -> A4 print.
// Asserts against the server: stored total = total shown, invoice number is previous + 1, customer ledger/balance updated,
// A4 PDF is served. Run at d1440, m360, t752. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { SLUG, call, must, signInFor, feOrigin, freshCart, invoiceSeq, posPickCustomer, posAddByPicker, isWide, money, r2, customerBalance } from './gateKit.js'

test('J2 POS cash sale: total = server total, invoice number +1, ledger updated, A4 PDF available', async ({ page }, info) => {
  test.setTimeout(90000)
  const { customer, products } = await freshCart(SLUG, 'j2')
  const barcode = products[0].barcode
  expect(barcode, 'fixture product has a barcode').toBeTruthy()

  // Prime the numbering with an API sale, then expect the UI sale to take exactly the next number.
  const prime = await must(SLUG, '/api/sales', { method: 'POST', body: { customerId: customer.id, items: [{ productId: products[2].id, unitType: 'PIECE', qty: 1, unitPrice: 12.25 }], payments: [{ method: 'CASH', amount: 100 }] } })
  const primeNo = prime.invoiceNo
  const before = await customerBalance(SLUG, customer.id)

  await signInFor(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  await posPickCustomer(page, customer.name)

  // Item 1 by barcode: the barcode typed in the product picker, Enter adds the exact match. Items 2 and 3 by name.
  const addRow = page.getByRole('button', { name: /^(Add Row|Add Product to Bill)$/ }).filter({ visible: true }).first()
  await addRow.click()
  const box = page.getByPlaceholder(/Search name, SKU, barcode/).filter({ visible: true }).first()
  await box.fill(barcode)
  await expect(page.getByRole('button').filter({ hasText: products[0].nameEn }).filter({ visible: true }).first()).toBeVisible()
  await box.press('Enter')
  await page.waitForTimeout(500)
  await posAddByPicker(page, products[1].nameEn)
  await posAddByPicker(page, products[2].nameEn)

  // Phones keep discount and payment in the Checkout sheet; wide layouts show them on the page.
  if (!isWide(page)) await page.getByRole('button', { name: /^Checkout$/ }).filter({ visible: true }).first().click()
  const discountLabel = isWide(page) ? /^Discount$/ : /^Discount \(/
  const discountBox = page.locator('label').filter({ hasText: discountLabel }).filter({ visible: true }).first().locator('xpath=../..').locator('input').first()
  await discountBox.fill('5.00')
  const methods = page.locator('select').filter({ has: page.locator('option[value="Cash"]') }).filter({ visible: true })
  if ((await methods.count()) === 0) await page.getByRole('button', { name: /^Payment/ }).filter({ visible: true }).first().click()
  await methods.first().selectOption('Cash')

  const totalLabel = page.getByText('Grand Total').filter({ visible: true }).first()
  const shown = money(await totalLabel.locator('xpath=..').innerText())
  expect(shown, 'grand total on screen').toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath(`j2-before-save-${info.project.name}.png`) })

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
  const saveName = isWide(page) ? 'Save Invoice' : /Save & Generate Invoice/
  await page.getByRole('button', { name: saveName, exact: isWide(page) }).filter({ visible: true }).first().click()
  const res = await saved
  const body = await res.json().catch(() => ({}))
  expect(res.status(), JSON.stringify(body).slice(0, 300)).toBeLessThan(300)
  const saleId = body.data?.id ?? body.data?.Id
  expect(saleId).toBeTruthy()

  // Server truth.
  const stored = await must(SLUG, `/api/sales/${saleId}`)
  expect(r2(stored.grandTotal), 'stored total equals the total shown to the cashier').toBeCloseTo(shown, 2)
  expect(r2(stored.discount), 'invoice discount stored').toBeCloseTo(5, 2)
  expect((stored.items || []).length, 'three lines saved').toBe(3)
  expect(String(stored.paymentStatus).toLowerCase(), 'cash sale is paid').toBe('paid')
  expect(invoiceSeq(stored.invoiceNo), `invoice number ${stored.invoiceNo} follows ${primeNo} by exactly 1`).toBe(invoiceSeq(primeNo) + 1)

  // Customer ledger / balance: balance moved by (invoice total - paid) and the ledger lists the invoice.
  const after = await customerBalance(SLUG, customer.id)
  expect(after, 'balance = before + total - paid').toBeCloseTo(before + r2(stored.grandTotal) - r2(stored.paidAmount ?? stored.grandTotal), 2)
  const ledger = JSON.stringify((await call(SLUG, `/api/customers/${customer.id}/ledger`)).json)
  expect(ledger, 'customer ledger lists the new invoice').toContain(stored.invoiceNo)

  // A4 print: the success dialog offers A4 and the server renders a real PDF.
  const pdf = page.waitForResponse((r) => /\/api\/sales\/\d+\/pdf/.test(r.url()) && /A4/i.test(r.url()), { timeout: 30000 })
  await page.getByRole('button', { name: /A4/ }).filter({ visible: true }).first().click()
  const pdfRes = await pdf
  expect(pdfRes.status()).toBe(200)
  expect(pdfRes.headers()['content-type'] || '').toMatch(/pdf/)
  expect((await pdfRes.body()).subarray(0, 4).toString()).toBe('%PDF')
})
