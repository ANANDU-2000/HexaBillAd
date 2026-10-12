import { openReport } from './reportNav.js'
// Reports > Customer Aging and AP Aging: each bucket card on screen equals the aging the API returns for today.
// AG-01: the 0-30, 31-60 and 61-90 buckets are sent as bucket0_30, bucket31_60 and bucket61_90. The response
// converter used to rename them (bucket030), so the cards showed 0.00. On this tenant only the 0-30 bucket has
// invoices today, so the other buckets are compared as zero. Read-only. Synthetic local tenant only.
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

// The page sends its own local date as asOfDate (today by default).
const today = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

const BUCKETS = [
  ['0-30 Days', 'bucket0_30'],
  ['31-60 Days', 'bucket31_60'],
  ['61-90 Days', 'bucket61_90'],
  ['90+ Days', 'bucket90Plus'],
]

// The card for a label: the innermost div that holds the label (the card itself).
const card = (page, label) => page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last()

async function expectAgingCards (page, report, unit) {
  for (const [label, key] of BUCKETS) {
    const text = await card(page, label).innerText()
    expect(num(text), `${label} amount on screen`).toBeCloseTo(Number(report[key]?.total ?? 0), 2)
    const count = text.match(new RegExp(`(\\d+) ${unit}`))
    expect(Number(count?.[1] ?? NaN), `${label} count on screen`).toBe(Number(report[key]?.count ?? 0))
  }
  const total = await card(page, 'Total Outstanding').innerText()
  expect(num(total), 'Total Outstanding on screen').toBeCloseTo(Number(report.totalOutstanding), 2)
}

test('Customer Aging: the bucket cards equal the aging the API returns for today', async ({ page }) => {
  const report = (await api(`/api/reports/aging?asOfDate=${today()}`)).json.data || {}
  expect(report.totalOutstanding, 'the aging must come back from the API').toBeDefined()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
  const loaded = page.waitForResponse((r) => /\/api\/reports\/aging\?/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200)
  await openReport(page, 'Aging')
  await loaded
  await expect(card(page, '90+ Days')).toBeVisible()
  await expectAgingCards(page, report, 'invoices')
})

test('AP Aging: the bucket cards equal the supplier aging the API returns for today', async ({ page }) => {
  const report = (await api(`/api/reports/ap-aging?asOfDate=${today()}`)).json.data || {}
  expect(report.totalOutstanding, 'the AP aging must come back from the API').toBeDefined()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/reports`, { waitUntil: 'networkidle' })
  const loaded = page.waitForResponse((r) => /\/api\/reports\/ap-aging\?/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200)
  await openReport(page, 'AP aging')
  await loaded
  await expect(card(page, '90+ Days')).toBeVisible()
  await expectAgingCards(page, report, 'suppliers')
})
