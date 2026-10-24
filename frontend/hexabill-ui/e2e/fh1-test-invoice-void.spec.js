// FrozenHub 1 test-bill clean-up rehearsal: the owner deletes test invoices from Billing History. Payments must be
// voided (kept), the test customer must drop to zero, and a genuine customer's invoices and balance must not move.
// Synthetic local tenant only (frozenhub1-test on the isolated synthetic host). Run with --project=d1440 / m390.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { apiLogin, signIn, feOrigin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'frozenhub1-test'
const PSQL = process.env.HEXABILL_E2E_PSQL // psql.exe for read-back of the synthetic DB
const PG = process.env.HEXABILL_E2E_PG_ARGS // e.g. "-h 127.0.0.1 -p 55901 -U hbtest -d hexabill_codex_browser_fh"

async function call (urlPath, method = 'GET', body) {
  const { token } = await apiLogin(SLUG)
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${urlPath}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  return json.data
}

const sql = (q) => execFileSync(PSQL, [...PG.split(' '), '-tAc', q], { encoding: 'utf8' }).trim()

test('owner deletes test invoices: payments void, test customer zero, genuine customer untouched', async ({ page }) => {
  test.skip(!PSQL || !PG, 'needs the synthetic DB read-back')
  const stamp = `${Date.now()}`
  const product = await call('/api/products', 'POST', { sku: `VD-${stamp}`, nameEn: `VOID QA ITEM ${stamp}`, unitType: 'CRTN', conversionToBase: 1, costPrice: 5, sellPrice: 10, stockQty: 0 })
  await call('/api/purchases', 'POST', { supplierName: `VD stock ${stamp}`, invoiceNo: `VD-S-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash', items: [{ productId: product.id, unitType: 'CRTN', qty: 20, unitCost: 5 }] })
  const testCustomer = await call('/api/customers', 'POST', { name: `Onboard test ${stamp}`, phone: `050${stamp.slice(-7)}`, creditLimit: 1000, customerType: 'Credit' })
  const genuine = await call('/api/customers', 'POST', { name: `Genuine cafe ${stamp}`, phone: `052${stamp.slice(-7)}`, creditLimit: 5000, customerType: 'Credit' })
  const sale = (customerId, ref) => call('/api/sales', 'POST', { customerId, externalReference: `vd-${ref}-${stamp}`, items: [{ productId: product.id, unitType: 'CRTN', qty: 1, unitPrice: 10 }] })
  const tPaid = await sale(testCustomer.id, 'tp')
  const tLegacy = await sale(testCustomer.id, 'tl')
  const tPending = await sale(testCustomer.id, 'tn')
  const gPaid = await sale(genuine.id, 'gp')
  const gPending = await sale(genuine.id, 'gn')
  for (const s of [tPaid, tLegacy, gPaid]) {
    await call('/api/payments', 'POST', { customerId: s.customerId, saleId: s.id, amount: Number(s.grandTotal), mode: 'CASH', reference: null, paymentDate: new Date().toISOString() })
  }
  // Mirror production payment 1462: a settled payment stored with the legacy "Completed" status.
  sql(`update "Payments" set "Status"='Completed' where "SaleId"=${tLegacy.id}`)
  const genuineBefore = sql(`select "Balance"||'|'||"PendingBalance"||'|'||"TotalSales"||'|'||"TotalPayments" from "Customers" where "Id"=${genuine.id}`)
  const stockBefore = Number(sql(`select "StockQty" from "Products" where "Id"=${product.id}`))

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/billing-history`, { waitUntil: 'networkidle' })
  const wide = page.viewportSize().width >= 768
  for (const s of [tPaid, tLegacy, tPending]) {
    if (wide) {
      await page.locator('tr', { hasText: s.invoiceNo }).getByRole('button', { name: 'Delete Invoice (Admin Only)' }).click()
    } else {
      const row = page.locator('main ul.md\\:hidden > li', { hasText: s.invoiceNo })
      await row.getByRole('button', { name: /more|actions/i }).last().click()
      await page.getByRole('menuitem', { name: 'Delete invoice' }).or(page.getByRole('button', { name: 'Delete invoice' })).first().click()
    }
    const dialog = page.getByRole('dialog').filter({ hasText: 'voids its payments' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').fill('DELETE')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText(s.invoiceNo, { exact: true })).toHaveCount(0)
  }
  await page.screenshot({ path: test.info().outputPath(`after-delete-${page.viewportSize().width}.png`) })

  const ids = [tPaid.id, tLegacy.id, tPending.id].join(',')
  expect(sql(`select count(*) from "Sales" where "Id" in (${ids}) and "IsDeleted"`)).toBe('3')
  expect(sql(`select count(*) from "Sales" where "Id" in (${ids}) and "InvoiceNo" is not null`)).toBe('3')
  expect(sql(`select string_agg("Status", ',' order by "SaleId") from "Payments" where "SaleId" in (${ids})`)).toBe('VOID,VOID')
  expect(sql(`select "Balance"||'|'||"PendingBalance"||'|'||"TotalSales"||'|'||"TotalPayments" from "Customers" where "Id"=${testCustomer.id}`)).toBe('0.00|0.00|0.00|0.00')
  expect(sql(`select "Balance"||'|'||"PendingBalance"||'|'||"TotalSales"||'|'||"TotalPayments" from "Customers" where "Id"=${genuine.id}`)).toBe(genuineBefore)
  expect(sql(`select count(*) from "Sales" where "Id" in (${gPaid.id},${gPending.id}) and not "IsDeleted"`)).toBe('2')
  expect(sql(`select "Status" from "Payments" where "SaleId"=${gPaid.id}`)).toBe('CLEARED')
  expect(Number(sql(`select "StockQty" from "Products" where "Id"=${product.id}`))).toBe(stockBefore + 3)
  expect(sql(`select count(*) from "AuditLogs" where "Action"='Sale Deleted' and "EntityId" in (${ids}) and "Details" like '%Voided payments:%'`)).toBe('3')
})
