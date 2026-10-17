import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

test('full credit return keeps five AED credit and separates goods from receipts', async ({ page }) => {
  if (API !== 'http://127.0.0.1:5078' || process.env.PGHOST !== '127.0.0.1'
      || !/^hexabill_codex_browser_/.test(process.env.PGDATABASE || '') || !process.env.HEXABILL_QA_PSQL) {
    throw new Error('Requires the guarded synthetic API and disposable loopback PostgreSQL.')
  }
  expect((await (await fetch(`${API}/__synthetic-host`)).json()).syntheticOnly).toBe(true)
  const session = await apiLogin(SLUG)
  async function api(path, body, key) {
    const response = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json',
        'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE,
        ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const json = await response.json()
    expect(response.ok, `${path}: ${response.status} ${JSON.stringify(json).slice(0, 200)}`).toBe(true)
    return json.data
  }
  const stamp = `${Date.now()}`
  const name = `QA return ${stamp}`
  const baseline = await api('/api/reports/summary?refresh=true')
  const customer = await api('/api/customers', { name, creditLimit: 1000, customerType: 'Credit' })
  const product = await api('/api/products', { sku: `RET-${stamp}`, nameEn: name, unitType: 'PIECE',
    conversionToBase: 1, costPrice: 10, sellPrice: 15, stockQty: 2 })
  const sale = await api('/api/sales', { customerId: customer.id, externalReference: `return-${stamp}`,
    items: [{ productId: product.id, unitType: 'PIECE', qty: 1, unitPrice: 15 }] })
  expect(sale.grandTotal).toBe(15.75)
  await api('/api/payments', { customerId: customer.id, saleId: sale.id, amount: 5, mode: 'CASH' }, `ret-pay-${stamp}`)
  const detail = await api(`/api/sales/${sale.id}`)
  const returned = await api('/api/returns/sales', { saleId: sale.id, returnType: 'CreditIssued', reason: 'Synthetic full return',
    items: [{ saleItemId: detail.items[0].id, qty: 1, stockEffect: true, condition: 'resellable' }] })
  expect(returned.grandTotal).toBe(15.75)
  expect((await api(`/api/customers/${customer.id}`)).balance).toBe(-5)
  const pending = await api(`/api/reports/pending-bills?customerId=${customer.id}&pageSize=1`)
  expect(pending.totalCount).toBe(0)
  expect(pending.items).toEqual([])
  expect((await api(`/api/reports/aging?customerId=${customer.id}`)).totalOutstanding).toBe(0)
  const summaryAfter = await api('/api/reports/summary?refresh=true')
  expect(summaryAfter.pendingBillsAmount).toBe(baseline.pendingBillsAmount)
  expect(summaryAfter.pendingBills).toBe(baseline.pendingBills)
  expect(summaryAfter.netSalesToday).toBe(baseline.netSalesToday)
  expect(summaryAfter.cashCollectionsTotal).toBe(baseline.cashCollectionsTotal + 5)
  expect((await api('/api/reports/worksheet')).pendingAmount).toBe(summaryAfter.pendingBillsAmount)

  const ids = [customer.id, sale.id, product.id, Number(session.user.tenantId)]
  expect(ids.every(Number.isInteger)).toBe(true)
  const [customerId, saleId, productId, tenantId] = ids
  const sql = `SELECT json_build_object('balance', c."Balance", 'paid', s."PaidAmount", 'total', s."GrandTotal", 'stock', p."StockQty", 'returns', (SELECT count(*) FROM "SaleReturns" WHERE "SaleId"=${saleId} AND "TenantId"=${tenantId})) FROM "Customers" c JOIN "Sales" s ON s."CustomerId"=c."Id" JOIN "Products" p ON p."Id"=${productId} WHERE c."Id"=${customerId} AND c."TenantId"=${tenantId} AND s."Id"=${saleId} AND s."TenantId"=${tenantId} AND p."TenantId"=${tenantId};`
  const stored = JSON.parse(execFileSync(process.env.HEXABILL_QA_PSQL, ['-X', '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim())
  expect(stored).toEqual({ balance: -5, paid: 5, total: 15.75, stock: Number(product.stockQty), returns: 1 })

  process.env['HEXABILL_E2E_EMAIL_FROZENHUB1-TEST'] = 'owner@frozenhub1-test.hexabill.local'
  const other = await apiLogin('frozenhub1-test')
  const otherHeaders = {
    Authorization: `Bearer ${other.token}`, 'X-HexaBill-Original-Host': 'frozenhub1-test.localhost',
    'X-HexaBill-Edge-Secret': EDGE,
  }
  const denied = await fetch(`${API}/api/sales/${sale.id}`, { headers: otherHeaders })
  expect(denied.status, 'non-member invoice is not found').toBe(404)
  const forged = await fetch(`${API}/api/sales/${sale.id}`, { headers: { ...otherHeaders, 'X-Tenant-Id': String(tenantId) } })
  expect(forged.status, 'forged tenant header is forbidden').toBe(403)

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/sales-ledger?name=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' })
  const summary = page.locator('div.flex-shrink-0').filter({ has: page.getByText('Totals:', { exact: true }) })
  await expect(summary).toContainText('Balance Cr: 5.00 AED')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: /Excel/ }).click()
  const download = await downloadEvent
  const csv = await readFile(await download.path(), 'utf8')
  const [csvHeader, ...csvRows] = csv.trim().split(/\r?\n/)
  const fields = csvHeader.split(',')
  const returnRow = csvRows.find(row => row.includes(returned.returnNo)).split(',').map(cell => cell.replace(/^"|"$/g, ''))
  expect(returnRow[fields.indexOf('Returns')]).toBe('15.75')
  expect(returnRow[fields.indexOf('Paid Amount')]).toBe('0.00')
  await expect(summary).toContainText('Unpaid 0.00 AED')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(summary).toContainText('Balance Cr: 5.00 AED')
  if (page.viewportSize().width >= 768) {
    const header = page.getByRole('columnheader', { name: 'Returns', exact: true })
    await expect(header).toBeVisible()
    const row = page.locator('tbody tr').filter({ hasText: returned.returnNo })
    const headings = await page.locator('thead th').allTextContents()
    const returnIndex = headings.findIndex(t => t.trim() === 'Returns')
    const paidIndex = headings.findIndex(t => t.trim() === 'Paid Amount')
    await expect(row.locator('td').nth(returnIndex)).toHaveText('15.75 AED')
    await expect(row.locator('td').nth(paidIndex)).toHaveText('-')
  } else {
    const card = page.locator('div.border').filter({ has: page.getByText(returned.returnNo, { exact: true }) }).last()
    await expect(card.getByText('Returns', { exact: true })).toBeVisible()
  }
})
