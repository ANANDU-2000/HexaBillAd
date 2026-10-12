import { openReport } from './reportNav.js'
// Reports > Customers (unpaid 1+ days) and Overdue (30+ days): each customer row shows the balance the API returns,
// and no customer the API leaves out is listed. This endpoint failed with a 500 on the local SQLite database
// (OUT-01: SQLite cannot ORDER BY a decimal), so this test also guards that. Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function api (path) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const num = (text) => {
  const m = String(text).match(/-?[\d,]+\.\d{2}/)
  return m ? Number(m[0].replace(/,/g, '')) : NaN
}

for (const [tab, days] of [['Customers', 1], ['Overdue', 30]]) {
  test(`${tab} tab: customers and balances equal the API (${days}+ days)`, async ({ page }) => {
    const res = await api(`/api/reports/outstanding?days=${days}&page=1&pageSize=100`)
    expect(res.status, `GET outstanding: ${JSON.stringify(res.json).slice(0, 160)}`).toBe(200)
    const expected = (res.json.data?.items || []).filter((c) => Number(c.balance) > 0.01)

    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
    const loaded = page.waitForResponse((r) => /\/api\/reports\/outstanding\?/.test(r.url()) && r.request().method() === 'GET')
    await openReport(page, tab)
    expect((await loaded).status(), 'the page gets the report').toBe(200)

    // The page loads twice and re-renders, so poll the whole list until it settles instead of checking parts of it.
    const rows = page.locator('div.justify-between').filter({ has: page.getByText('Outstanding Balance', { exact: true }) })
    const snapshot = async () => (await rows.evaluateAll((els) => els.map((el) => [el.querySelector('p.font-medium')?.textContent?.trim(), el.querySelector('p.font-semibold')?.textContent || ''])))
      .map(([name, text]) => [name, num(text)]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    const want = expected.map((c) => [c.name, Number(c.balance)]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    await expect.poll(async () => JSON.stringify((await snapshot()).map(([n, v]) => [n, Math.round(v * 100)])), { message: `${tab} rows equal the API` })
      .toBe(JSON.stringify(want.map(([n, v]) => [n, Math.round(v * 100)])))
  })
}
