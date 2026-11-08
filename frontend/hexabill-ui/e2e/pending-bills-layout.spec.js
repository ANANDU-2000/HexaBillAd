// Pending Bills: dense rows, every action on screen without sideways scroll, direct Pay, select-and-pay.
// Local synthetic tenant only. Reads and navigates; does not post money.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
import { ensureOwingCustomers } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('pending bills: compact rows, all actions visible, direct Pay', async ({ page }, info) => {
  await ensureOwingCustomers(SLUG, 12)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pending-bills`, { waitUntil: 'networkidle' })

  const vw = page.viewportSize().width
  await expect(page.getByRole('heading', { name: 'Pending Bills' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search pending bills' })).toBeVisible()

  // Title, search and buttons share the top; no sideways scroll at any width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  const titleBox = await page.getByRole('heading', { name: 'Pending Bills' }).boundingBox()
  expect(titleBox.y).toBeLessThan(140)

  // Every row's Pay button is inside the viewport (not clipped off the right edge).
  const pays = page.getByRole('link', { name: /^Receive payment from / })
  const count = await pays.count()
  expect(count).toBeGreaterThanOrEqual(5)
  for (let i = 0; i < Math.min(count, 12); i += 1) {
    const box = await pays.nth(i).boundingBox()
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1)
  }

  // The Pay button must have a real background: white text on a transparent button is invisible.
  const payBg = await pays.first().evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(payBg).not.toBe('rgba(0, 0, 0, 0)')

  // Dense rows: a collapsed row is at most 64px tall (was ~73px), so more customers fit on screen.
  const rowBox = await page.locator('tbody tr').first().boundingBox()
  expect(rowBox.height).toBeLessThanOrEqual(64)
  const inView = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().bottom <= window.innerHeight).length)
  info.annotations.push({ type: 'rows-in-first-screen', description: String(inView) })

  await page.screenshot({ path: process.env.PB_SHOT_DIR ? `${process.env.PB_SHOT_DIR}/pending-${info.project.name}.png` : undefined })

  // Direct Pay goes straight to the customer's payment entry.
  await pays.first().click()
  await expect(page).toHaveURL(/payments|ledger/)
})

test('pending bills: select live bills and pay selected', async ({ page }, info) => {
  await ensureOwingCustomers(SLUG, 3)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pending-bills`, { waitUntil: 'networkidle' })
  // The customer name toggles the bills on every width (the separate Bills button is hidden on phones).
  await page.locator('tbody button[aria-expanded]').first().click()
  const selectAll = page.getByLabel('Select all live bills')
  await expect(selectAll).toBeVisible()
  await selectAll.check()
  await expect(page.getByText(/\d+ selected · Total/)).toBeVisible()
  const paySelected = page.getByRole('link', { name: 'Pay selected' })
  await expect(paySelected).toBeVisible()
  const box = await paySelected.boundingBox()
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1)
  await page.screenshot({ path: process.env.PB_SHOT_DIR ? `${process.env.PB_SHOT_DIR}/pending-open-${info.project.name}.png` : undefined })
  await paySelected.click()
  await expect(page).toHaveURL(/payments|ledger/)
})
