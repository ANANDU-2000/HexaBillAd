import { openReport } from './reportNav.js'
// Reports > Sales: the Sales Details table lists every invoice the API returns for the range shown, with the same total
// and paid amount for each invoice (SL-02). The tab asks for one page of up to 100 invoices (SL-01), so this check
// fails by design if a range holds more than 100 invoices. Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

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
  await openReport(page, 'Sales')
  await loaded

  const rows = page.locator('table tbody tr').filter({ has: page.locator('td') })
  await expect(rows, `rows for ${from} to ${to}`).toHaveCount(report.totalCount)
  const byNo = new Map((report.items || []).map((i) => [i.invoiceNo, i]))
  // One snapshot of every row, so a re-render between reads cannot mix old and new rows.
  const table = await rows.evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText)))
  for (const cells of table) {
    // Columns: Invoice No, Date, Customer, Total, Paid, Balance, Status.
    const item = byNo.get(cells[0].trim())
    expect(item, `invoice ${cells[0]} is in the API range`).toBeDefined()
    expect(num(cells[3]), `${cells[0]} total on screen`).toBeCloseTo(Number(item.grandTotal), 2)
    expect(num(cells[4]), `${cells[0]} paid on screen`).toBeCloseTo(Number(item.paidAmount ?? 0), 2)
  }
})

// SL-01: the tab reads every page of the range. The endpoint is mocked with three pages (250 invoices) so the local
// tenant's data is not touched.
test('Sales: a range with several pages lists every invoice', async ({ page }) => {
  const total = 250
  const calls = []
  await page.route(/\/api\/reports\/sales\?/, async (route) => {
    const url = new URL(route.request().url())
    const pageNo = Number(url.searchParams.get('page') || 1)
    const size = Number(url.searchParams.get('pageSize') || 10)
    calls.push(pageNo)
    const items = []
    for (let n = (pageNo - 1) * size + 1; n <= Math.min(pageNo * size, total); n += 1) {
      items.push({ id: n, invoiceNo: `MOCK-${n}`, invoiceDate: '2026-10-01T09:00:00', customerName: 'Mock customer', grandTotal: 10, paidAmount: 10 })
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items, totalCount: total, page: pageNo, pageSize: size, totalPages: Math.ceil(total / size) } }),
    })
  })
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
  await openReport(page, 'Sales')
  await expect(page.locator('table tbody tr').filter({ has: page.locator('td') })).toHaveCount(total)
  expect([...new Set(calls)].sort((a, b) => a - b)).toEqual([1, 2, 3])
  await expect(page.getByText(/Showing the first/)).toHaveCount(0)
})
