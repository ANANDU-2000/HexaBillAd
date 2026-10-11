// Reports > Sales: the Sales Details table lists every invoice the API returns for the range shown, with the same total
// and paid amount for each invoice (SL-02). The tab asks for one page of up to 100 invoices (SL-01), so this check
// fails by design if a range holds more than 100 invoices. Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function api (path) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const num = (text) => {
  const m = String(text).match(/-?[\d,]+\.\d{2}/)
  return m ? Number(m[0].replace(/,/g, '')) : NaN
}

test('Sales: the table lists every invoice in the range with the API total and paid amount', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
  // The range comes from the page itself (it may be remembered from an earlier visit).
  const from = await page.getByLabel('From Date', { exact: true }).filter({ visible: true }).first().inputValue()
  const to = await page.getByLabel('To Date', { exact: true }).filter({ visible: true }).first().inputValue()
  // Same request the Sales tab makes: page 1, 100 rows.
  const report = (await api(`/api/reports/sales?fromDate=${from}&toDate=${to}&page=1&pageSize=100`)).json.data || {}
  expect(report.totalCount, 'the sales report must come back from the API').toBeDefined()
  expect(report.totalCount, 'more than 100 invoices in this range: see SL-01').toBeLessThanOrEqual(100)

  const loaded = page.waitForResponse((r) => /\/api\/reports\/sales\?/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200)
  await page.getByRole('tab', { name: 'Sales', exact: true }).filter({ visible: true }).first().click()
  await loaded

  const rows = page.locator('table tbody tr').filter({ has: page.locator('td') })
  await expect(rows, `rows for ${from} to ${to}`).toHaveCount(report.totalCount)
  const byNo = new Map((report.items || []).map((i) => [i.invoiceNo, i]))
  for (const row of await rows.all()) {
    // Columns: Invoice No, Date, Customer, Total, Paid, Balance, Status.
    const cells = await row.locator('td').allInnerTexts()
    const item = byNo.get(cells[0].trim())
    expect(item, `invoice ${cells[0]} is in the API range`).toBeDefined()
    expect(num(cells[3]), `${cells[0]} total on screen`).toBeCloseTo(Number(item.grandTotal), 2)
    expect(num(cells[4]), `${cells[0]} paid on screen`).toBeCloseTo(Number(item.paidAmount ?? 0), 2)
  }
})
