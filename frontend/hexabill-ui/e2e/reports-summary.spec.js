// Reports > Summary: the four cards (Total Sales, Total Purchases, Total Expenses, Net Profit) equal the summary the API
// returns for the date range the page shows. The API names its fields *Today, but they sum the selected range.
// Read-only. Synthetic local tenant only.
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

const CARDS = [
  ['Total Sales', 'salesToday'],
  ['Total Purchases', 'purchasesToday'],
  ['Total Expenses', 'expensesToday'],
  ['Net Profit', 'profitToday'],
]

test('Summary: the four cards equal the summary the API returns for the range on screen', async ({ page }) => {
  await signIn(page, SLUG)
  const loaded = page.waitForResponse((r) => /\/api\/reports\/summary\?/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200)
  await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
  await loaded
  // The range comes from the page itself (it may be remembered from an earlier visit), not from a default in this test.
  const from = await page.getByLabel('From Date', { exact: true }).filter({ visible: true }).first().inputValue()
  const to = await page.getByLabel('To Date', { exact: true }).filter({ visible: true }).first().inputValue()
  expect(from && to, 'the page shows a date range').toBeTruthy()
  const report = (await api(`/api/reports/summary?fromDate=${from}&toDate=${to}`)).json.data || {}
  expect(report.salesToday, 'the summary must come back from the API').toBeDefined()

  // The four cards sit in the summary grid (the only one with lg:grid-cols-4 that holds "Total Sales").
  const grid = page.locator('div[class*="lg:grid-cols-4"]').filter({ hasText: 'Total Sales' }).first()
  for (const [label, key] of CARDS) {
    const text = await grid.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last().innerText()
    expect(num(text), `${label} on screen for ${from} to ${to}`).toBeCloseTo(Number(report[key] ?? 0), 2)
  }
})
