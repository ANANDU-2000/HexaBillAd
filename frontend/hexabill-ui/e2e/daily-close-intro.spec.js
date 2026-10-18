// Daily close intro (DC-05): the page opens with a one-line purpose, and the settlement rule is kept word for word
// next to the cash rows it explains. Read-only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

test('daily close: short intro, settlement rule kept beside the cash rows', async ({ page }) => {
  await signIn(page, process.env.HEXABILL_E2E_SLUG || 'gulfharvest')
  await page.goto(`${feOrigin(process.env.HEXABILL_E2E_SLUG || 'gulfharvest')}/daily-close`, { waitUntil: 'networkidle' })
  const intro = page.getByText('Compare the expected cash to your physical count.', { exact: true })
  await expect(intro).toBeVisible()
  const box = await intro.boundingBox()
  expect(box.height, 'the intro takes one line or two, not three').toBeLessThan(48)
  const rule = page.getByText('Settlement adjustments are excluded from cash received.', { exact: true })
  await expect(rule).toBeVisible()
  const cash = await page.getByText('Customer cash (cleared)').boundingBox()
  const note = await rule.boundingBox()
  expect(note.y, 'the rule sits below the cash rows').toBeGreaterThan(cash.y)
})
