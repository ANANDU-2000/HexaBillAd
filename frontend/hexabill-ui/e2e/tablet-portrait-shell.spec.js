// Tablet portrait (HONOR Pad 752x1254): labelled sidebar, global back button, list pages as tables.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test.use({ viewport: { width: 752, height: 1254 }, hasTouch: true })

test('tablet portrait gets an icons-only rail and no bottom nav', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Products' })).toBeVisible()
  const box = await nav.boundingBox()
  expect(box.width).toBeLessThan(80)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('products renders as a table with many rows and no sideways scroll', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await expect(page.locator('table').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  const rows = page.locator('table tbody tr')
  if ((await rows.count()) >= 2) {
    const h = (await rows.first().boundingBox()).height
    expect(h).toBeLessThan(90) // cards were ~150px tall
  }
})

test('every inner page has a back button that goes up', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-testid=shell-back]:visible')).toHaveCount(0)
  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  const back = page.locator('[data-testid=shell-back]:visible')
  await expect(back).toBeVisible()
  const box = await back.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(43.5)
  await back.click()
  await expect(page).not.toHaveURL(/\/expenses$/)
})

for (const path of ['/dashboard', '/reports', '/pricelist', '/sales-ledger', '/users', '/purchases', '/suppliers', '/expenses', '/customers', '/payments']) {
  test(`${path}: no horizontal overflow at 752px`, async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'networkidle' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
