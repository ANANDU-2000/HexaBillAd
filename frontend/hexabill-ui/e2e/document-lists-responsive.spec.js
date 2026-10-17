// UX-02: quotation, delivery-note and salary-certificate lists need no sideways scrolling on a phone.
// One quotation is seeded through the API so the card path is exercised; the other two lists are checked
// in whatever state the synthetic tenant has (empty is valid). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const LISTS = [['/quotations', 'Quotations'], ['/delivery-notes', 'Delivery notes'], ['/salary-certificates', 'Salary certificates']]
const CUSTOMER = 'UX Audit Quote Customer With A Deliberately Long Trading Name L.L.C - S.P.C'

test.beforeAll(async () => {
  const s = await apiLogin(SLUG)
  const res = await fetch(`${API}/api/quotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    body: JSON.stringify({ customerName: CUSTOMER, status: 'Draft', items: [{ description: 'UX audit item', unitLabel: 'Pcs', qty: 2, unitPrice: 10 }] }),
  })
  expect(res.status, 'quotation seed').toBeLessThan(300)
})

// Real sideways scrollers only (auto/scroll), not truncated text.
const scrollers = (page) => page.evaluate(() => [...document.querySelectorAll('main *')]
  .filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1 && el.getClientRects().length).length)

for (const [path, label] of LISTS) {
  test(`${label}: no horizontal scrolling on a phone`, async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'networkidle' })
    const vp = page.viewportSize()
    if (vp.width < 768) {
      expect(await scrollers(page), 'no horizontally scrolling container on a phone').toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    }
  })
}

test('quotation card shows customer beside every action and fits the screen', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  const vp = page.viewportSize()
  if (vp.width >= 768) return
  const card = page.getByRole('list', { name: 'Quotations' }).getByRole('listitem').filter({ hasText: 'UX Audit Quote Customer' }).first()
  await expect(card).toBeVisible()
  for (const name of [/^Edit /, /^Print /, /^Full /, /^PDF /, /^Delete /]) {
    const b = await card.getByRole('button', { name }).boundingBox()
    expect(b.height).toBeGreaterThanOrEqual(43)
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width)
  }
})
