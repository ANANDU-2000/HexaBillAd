// E2E-G1 / J3: POS credit sale -> Customer Ledger -> receive a partial payment -> the rest is still pending.
// Server asserts: the credit invoice is unpaid, the balance equals before - partial, and a double-click on Save
// creates exactly one payment. Wide layouts create the credit sale on the POS page; phones create the same sale through
// the API (the phone POS checkout sheet is covered by e2e/pos-checkout.spec.js). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { pickValue } from '../pickers.js'
import { SLUG, must, signInFor, feOrigin, freshCart, posPickCustomer, isWide, r2, customerBalance, rows } from './gateKit.js'

const paymentsFor = async (customerId, amount) =>
  rows(await must(SLUG, '/api/payments?page=1&pageSize=200')).filter((p) => p.customerId === customerId && Math.abs(Number(p.amount) - amount) < 0.001)

test('J3 credit sale, partial receipt in the ledger, pending shows the rest, double-click saves one payment', async ({ page }, info) => {
  test.setTimeout(150000)
  const { customer, products } = await freshCart(SLUG, 'j3')
  let sale
  if (isWide(page)) {
    await signInFor(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await posPickCustomer(page, customer.name)
    await page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true }).first().click()
    await page.getByPlaceholder(/Search name, SKU, barcode/).filter({ visible: true }).first().fill(products[0].nameEn)
    await page.getByRole('button').filter({ hasText: products[0].nameEn }).filter({ visible: true }).first().click()
    await page.locator('select').filter({ has: page.locator('option[value="Pending"]') }).filter({ visible: true }).first().selectOption('Pending')
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
    await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
    const body = await (await saved).json()
    sale = await must(SLUG, `/api/sales/${body.data?.id ?? body.data?.Id}`)
  } else {
    sale = await must(SLUG, '/api/sales', { method: 'POST', body: { customerId: customer.id, items: [{ productId: products[0].id, unitType: 'PIECE', qty: 1, unitPrice: 20 }], payments: [] } })
    sale = await must(SLUG, `/api/sales/${sale.id}`)
  }
  expect(String(sale.paymentStatus).toLowerCase(), 'credit sale is not paid').not.toBe('paid')
  const total = r2(sale.grandTotal)
  expect(total).toBeGreaterThan(0)
  const before = await customerBalance(SLUG, customer.id)
  expect(before, 'balance rose by the invoice total').toBeGreaterThanOrEqual(total - 0.005)

  const partial = r2(total * 0.4)
  const remaining = r2(total - partial)

  // Customer Ledger: receive the partial payment.
  await signInFor(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customer' }).fill(customer.name)
  await page.locator('main button').filter({ hasText: customer.name }).first().click()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Receive payment/ }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').first()
  // Apply the receipt to the credit invoice (the modal defaults to "No Invoice (General Payment)").
  await pickValue(page, dialog.locator('[name="saleId"]'), sale.id)
  await dialog.locator('input[name="amount"]').fill(partial.toFixed(2))

  // Double-click Save: one payment must be created.
  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/payments$/.test(r.url())) posts++ })
  const save = dialog.getByRole('button', { name: 'Save Payment', exact: true })
  await save.dblclick()
  await expect.poll(async () => (await paymentsFor(customer.id, partial)).length, { timeout: 20000 }).toBe(1)
  await expect(dialog).toBeHidden({ timeout: 20000 })
  await page.waitForTimeout(800)
  expect((await paymentsFor(customer.id, partial)).length, 'double-click made exactly one payment').toBe(1)
  expect(posts, 'at most one POST reached the server').toBeLessThanOrEqual(2)

  // Server balance and the pending amount shown on the ledger.
  const after = await customerBalance(SLUG, customer.id)
  expect(r2(after), 'balance = before - partial').toBeCloseTo(r2(before - partial), 2)
  const outstanding = await must(SLUG, `/api/customers/${customer.id}/outstanding-invoices`)
  const pendingTotal = rows(outstanding).reduce((s, inv) => s + Number(inv.balanceAmount), 0)
  expect(r2(pendingTotal), 'server pending equals the remainder').toBeCloseTo(remaining, 2)
  await page.getByRole('tab', { name: /^Pending/ }).filter({ visible: true }).first().click()
  await expect(page.getByText(new RegExp(`${remaining.toFixed(2).replace('.', '\\.')}`)).filter({ visible: true }).first(), `ledger shows the remaining ${remaining.toFixed(2)}`).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: info.outputPath(`j3-ledger-${info.project.name}.png`) })
})
