// Sidebar brand: a long company name wraps (up to three lines) instead of being cut to "GULF HARVEST G…" (UX-S08).
// Desktop only (the sidebar). Read-only: the name is read from the page, nothing is saved.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('sidebar shows the full company name', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 1024, 'the sidebar is a desktop layout')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const brand = page.locator('a[aria-label$="— dashboard"]').filter({ visible: true }).first()
  const full = (await brand.getAttribute('title')) || ''
  expect(full.length, 'the brand link carries the full company name').toBeGreaterThan(0)
  const label = brand.locator('span').filter({ hasText: full }).first()
  // Not clipped: the text fits its box (no horizontal cut), and it may use up to three lines.
  const fits = await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)
  expect(fits, `"${full}" is shown in full`).toBe(true)
})
