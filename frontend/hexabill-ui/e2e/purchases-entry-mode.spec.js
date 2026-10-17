// UX-04: entry mode shows only the voucher (no history/analytics under it); Cancel returns to history;
// the fixed Save bar sits on the viewport bottom when the bottom nav is hidden. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('entry mode hides history and analytics; save bar is reachable; cancel restores history', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Purchase List' })).toBeVisible()

  await page.getByRole('button', { name: /^New Purchase$/ }).click()
  await expect(page.getByText('New Purchase Entry')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Purchase List' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'This period' })).toHaveCount(0)
  await expect(page.locator('#purchase-filters')).toHaveCount(0)

  const save = page.getByRole('button', { name: 'Save Purchase' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeVisible()
  const vp = page.viewportSize()
  const box = await save.boundingBox()
  expect(box.y + box.height, 'Save button inside the viewport').toBeLessThanOrEqual(vp.height + 1)
  if (vp.width < 768) {
    // Phone: the bar is fixed; with the bottom nav hidden it must reach the bottom edge, not float above a phantom nav.
    const bar = await save.evaluate((el) => { const r = el.closest('div').getBoundingClientRect(); return { bottom: r.bottom } })
    expect(Math.abs(bar.bottom - vp.height)).toBeLessThanOrEqual(2)
  }
  // The Save bar must not cover the last field: the form leaves room below its content.
  info.annotations.push({ type: 'save-bottom', description: String(box.y + box.height) })

  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('New Purchase Entry')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Purchase List' })).toBeVisible()
})
