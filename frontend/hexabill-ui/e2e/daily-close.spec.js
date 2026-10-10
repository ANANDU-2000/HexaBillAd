// Daily close: the close task owns the phone screen (no bottom nav), its actions stay reachable in a sticky
// footer, and a saved draft comes back after a refresh. Synthetic local tenant only. Requires the
// daily_close flag on that tenant (see PREMIUM-UX-TRACKER, Daily close: local setup step).
// Never clicks "Submit close" here: that would close the synthetic business day.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest'

async function openDailyClose (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/daily-close`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Daily close' })).toBeVisible()
}

test('phones: the bottom nav is hidden and the close actions stay on screen', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width >= 768, 'Sticky footer and bottom nav are phone-only')
  await openDailyClose(page)
  await expect(page.locator('nav[aria-label="Main navigation"]')).toHaveCount(0)
  // Scroll to the end of the form; the footer must still be on screen.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Submit close' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Refresh expected' })).toBeInViewport()
})

test('a saved draft count is persisted and comes back after refresh', async ({ page }) => {
  await openDailyClose(page)
  const counted = page.locator('label', { hasText: /^Counted cash/ }).locator('input')
  await counted.fill('123.45')
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/daily-close/.test(r.url()))
  await page.getByRole('button', { name: 'Save draft' }).click()
  expect((await saved).status()).toBeLessThan(300)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('label', { hasText: /^Counted cash/ }).locator('input')).toHaveValue('123.45')
})
