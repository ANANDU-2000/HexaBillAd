// VAT return: the draft return boxes on the screen equal the figures the backend computes for the same period.
// The period is the page's own suggested period; the expected figures are read from the API for that period.
// Read-only: nothing is locked, frozen or exported. Synthetic local tenant only.
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

const LABELS = [['Box 1a', 'box1a'], ['Box 1b', 'box1b'], ['Box 2', 'box2'], ['Box 3', 'box3'], ['Box 9b', 'box9b'], ['Box 12', 'box12'], ['Box 13a', 'box13a'], ['Box 13b', 'box13b']]
const pick = (d, key) => d[key] ?? d[key.charAt(0).toUpperCase() + key.slice(1)]

// Open the draft boxes for a period and compare each with the API figure for the same period.
async function expectDraftBoxes (page, from, to) {
  const expected = (await api(`/api/reports/vat-return?from=${from}&to=${to}`)).json.data || {}
  // The boxes show zeros until the report arrives: wait for the page's own request for this period first.
  const report = page.waitForResponse((r) => /\/api\/reports\/vat-return\?/.test(r.url()) && r.url().includes(from) && r.request().method() === 'GET' && r.status() === 200)
  await page.goto(`${feOrigin(SLUG)}/vat-return?from=${from}&to=${to}`, { waitUntil: 'networkidle' })
  await report
  await page.getByRole('button', { name: 'Return boxes (draft)' }).filter({ visible: true }).first().click()
  const section = page.locator('section[aria-label="Draft return boxes"]').first()
  await expect(section).toBeVisible()
  for (const [label, key] of LABELS) {
    // The innermost row that holds this exact label; its own value (dd) is the figure on screen.
    const row = section.locator('div').filter({ has: page.locator('dt', { hasText: new RegExp('^' + label + '$') }) }).last()
    const shown = num(await row.locator('dd').innerText())
    expect(shown, `${label} on screen for ${from} to ${to}`).toBeCloseTo(Number(pick(expected, key) ?? 0), 2)
  }
  return expected
}

test('VAT return: draft boxes on screen equal the backend figures for the same period', async ({ page }) => {
  const suggest = (await api('/api/reports/vat-return/suggest-period')).json.data || {}
  const from = String(suggest.from ?? suggest.periodStart ?? suggest.startDate).slice(0, 10)
  const to = String(suggest.to ?? suggest.periodEnd ?? suggest.endDate).slice(0, 10)
  expect(from && to, `suggested period: ${JSON.stringify(suggest).slice(0, 200)}`).toBeTruthy()
  await signIn(page, SLUG)
  await expectDraftBoxes(page, from, to)
})

// VR-02: other periods. The API accepts only a full FTA quarter or a full calendar year. An empty quarter shows zeros
// everywhere; the full year (a larger period with data) matches the API too.
for (const [name, from, to] of [['a period with no data', '2020-02-01', '2020-04-30'], ['the full calendar year', '2026-01-01', '2026-12-31']]) {
  test(`VAT return: ${name} equals the backend figures`, async ({ page }) => {
    await signIn(page, SLUG)
    const expected = await expectDraftBoxes(page, from, to)
    if (name === 'a period with no data') {
      for (const [, key] of LABELS) expect(Number(pick(expected, key) ?? 0), `API ${key} for an empty period`).toBe(0)
    }
  })
}

// Dates typed into the boxes and applied: a window inside one quarter is widened to that whole quarter (and the page
// says what it is showing); a window that spans quarters is refused with the rule, and no request is sent.
async function applyDates (page, from, to) {
  await page.goto(`${feOrigin(SLUG)}/vat-return`, { waitUntil: 'networkidle' })
  const dates = page.locator('input[type="date"]').filter({ visible: true })
  await dates.nth(0).fill(from)
  await dates.nth(1).fill(to)
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  return dates
}

test('VAT return: a window inside one quarter is widened to the whole quarter and the page says so', async ({ page }) => {
  await signIn(page, SLUG)
  const report = page.waitForResponse((r) => /\/api\/reports\/vat-return\?/.test(r.url()) && r.url().includes('2026-08-01') && r.url().includes('2026-10-31') && r.status() === 200)
  const dates = await applyDates(page, '2026-10-01', '2026-10-11')
  await report
  await expect(dates.nth(0)).toHaveValue('2026-08-01')
  await expect(dates.nth(1)).toHaveValue('2026-10-31')
  await expect(page.getByText(/Showing: 2026-08-01 . 2026-10-31 \(Q3-2026\)/).first()).toBeVisible()
})

test('VAT return: a window spanning quarters is refused with the rule shown and no request sent', async ({ page }) => {
  await signIn(page, SLUG)
  const sent = []
  page.on('request', (r) => { if (/\/api\/reports\/vat-return\?/.test(r.url()) && r.url().includes('2026-09-15')) sent.push(r.url()) })
  await applyDates(page, '2026-07-15', '2026-09-15')
  await expect(page.getByText(/must be a full quarter/i).filter({ visible: true }).first()).toBeVisible()
  expect(sent, 'no report request for the refused window').toEqual([])
})
