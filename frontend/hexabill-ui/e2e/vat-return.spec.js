// VAT return: the draft return boxes on the screen equal the figures the backend computes for the same period.
// The period is the page's own suggested period; the expected figures are read from the API for that period.
// Read-only: nothing is locked, frozen or exported. Synthetic local tenant only.
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

test('VAT return: draft boxes on screen equal the backend figures for the same period', async ({ page }) => {
  const suggest = (await api('/api/reports/vat-return/suggest-period')).json.data || {}
  const from = suggest.from ?? suggest.periodStart ?? suggest.startDate
  const to = suggest.to ?? suggest.periodEnd ?? suggest.endDate
  expect(from && to, `suggested period: ${JSON.stringify(suggest).slice(0, 200)}`).toBeTruthy()
  const expected = (await api(`/api/reports/vat-return?from=${String(from).slice(0, 10)}&to=${String(to).slice(0, 10)}`)).json.data || {}
  const expectedBoxes = {
    'Box 1a': expected.box1a ?? expected.Box1a,
    'Box 1b': expected.box1b ?? expected.Box1b,
    'Box 2': expected.box2 ?? expected.Box2,
    'Box 3': expected.box3 ?? expected.Box3,
    'Box 9b': expected.box9b ?? expected.Box9b,
    'Box 12': expected.box12 ?? expected.Box12,
    'Box 13a': expected.box13a ?? expected.Box13a,
    'Box 13b': expected.box13b ?? expected.Box13b,
  }

  await signIn(page, SLUG)
  // The boxes show zeros until the report arrives: wait for it before reading them.
  const report = page.waitForResponse((r) => /\/api\/reports\/vat-return\?/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200)
  await page.goto(`${feOrigin(SLUG)}/vat-return`, { waitUntil: 'networkidle' })
  await report
  await page.getByRole('button', { name: 'Return boxes (draft)' }).filter({ visible: true }).first().click()
  const section = page.getByRole('region', { name: 'Draft return boxes' }).or(page.locator('section[aria-label="Draft return boxes"]')).first()
  await expect(section).toBeVisible()

  for (const [label, value] of Object.entries(expectedBoxes)) {
    // The innermost row that holds this exact label; its own value (dd) is the figure on screen.
    const row = section.locator('div').filter({ has: page.locator('dt', { hasText: new RegExp('^' + label + '$') }) }).last()
    const shown = num(await row.locator('dd').innerText())
    expect(shown, `${label} on screen`).toBeCloseTo(Number(value ?? 0), 2)
  }
})
