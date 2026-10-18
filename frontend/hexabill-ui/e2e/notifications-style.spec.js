/* eslint-env node */
// Notifications are flat ERP style: square corners, status bar on the left, no emoji, no bounce, capped at three.
// Needs only Vite on :5173 (no API, no login): npm run dev, then
//   npx playwright test e2e/notifications-style.spec.js
import { test, expect } from '@playwright/test'

const ORIGIN = process.env.HEXABILL_FE_ORIGIN || 'http://localhost:5173'

test('toasts and inline notices use the flat style', async ({ page }, info) => {
  await page.goto(`${ORIGIN}/__design`, { waitUntil: 'networkidle' })
  const triggers = page.getByTestId('toast-triggers')
  await triggers.getByRole('button', { name: 'Success toast' }).click()
  await triggers.getByRole('button', { name: 'Error toast' }).click()
  await triggers.getByRole('button', { name: 'Info toast' }).click()
  const card = page.locator('.hb-toast:has-text("no outstanding invoices")').first()
  await expect(card).toBeVisible()
  const look = await card.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { radius: parseFloat(cs.borderTopLeftRadius), left: cs.borderLeftWidth, leftColor: cs.borderLeftColor, bg: cs.backgroundColor }
  })
  expect(look.radius).toBeLessThanOrEqual(4)
  expect(look.left).toBe('4px')
  expect(look.leftColor).toBe('rgb(220, 38, 38)')
  expect(look.bg).toBe('rgb(255, 255, 255)')
  expect(await card.locator('svg').count()).toBeGreaterThan(0)

  const width = page.viewportSize().width
  const box = await card.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)

  await page.getByTestId('toast-triggers').getByRole('button', { name: 'Loading toast' }).click()
  await page.screenshot({ path: `e2e/.shots/notifications-${info.project.name}.png` })
  await card.getByRole('button', { name: 'Dismiss notification' }).click()
  await expect(card).toBeHidden()

  const warning = page.locator('[role="alert"]:has-text("Low stock")')
  const wlook = await warning.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { radius: parseFloat(cs.borderTopLeftRadius), left: cs.borderLeftColor, bg: cs.backgroundColor }
  })
  expect(wlook.radius).toBeLessThanOrEqual(4)
  expect(wlook.bg).toBe('rgb(255, 255, 255)')
})
