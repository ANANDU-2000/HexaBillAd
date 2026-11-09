// MOB-P1-1: on a phone the owner Home shows sales, what is owed and the main actions in the first screen,
// with no horizontal page scroll. Read-only. Synthetic local tenant only.
// Updated for the current dashboard: "KPI summary" and "Quick actions" regions (the old "Period summary" is gone).
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('phone Home: KPIs and the main actions are visible without scrolling', async ({ page }) => {
  const vp = page.viewportSize()
  test.skip(vp.width >= 640, 'phone layout only')

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })

  const summary = page.getByRole('region', { name: 'KPI summary' })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Sales')
  await expect(summary).toContainText('Pending Amount')
  await expect(summary).toContainText('Received')

  const actions = page.getByRole('region', { name: 'Quick actions' })
  await expect(actions).toBeVisible()
  const newInvoice = actions.getByRole('button', { name: /New Invoice/ })
  await expect(newInvoice).toBeVisible()
  const box = await newInvoice.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)

  // Metric values must not be clipped by their cards.
  const clipped = await summary.evaluate((el) => [...el.querySelectorAll('p')].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent))
  expect(clipped, `clipped metric text: ${clipped.join(', ')}`).toEqual([])

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

  await newInvoice.click()
  await expect(page).toHaveURL(/\/pos/)
})
