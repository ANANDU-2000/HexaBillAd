// Payments list header and rows: one action row on phones, Add Payment is the only primary action,
// and a long customer name never pushes the amount onto the name. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest'
const PRIMARY_BLUE = 'rgb(37, 99, 235)' // primary-600 (#2563EB)

test('phones: Refresh, Bulk Payment and Add Payment share one row; Add Payment is the primary', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width >= 768, 'Icon-only refresh and one-row actions are phone layouts')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
  const bulk = page.getByRole('button', { name: 'Bulk Payment' })
  const add = page.getByRole('button', { name: 'Add Payment' })
  await expect(add).toBeVisible()
  const [r, b, a] = await Promise.all([refresh.boundingBox(), bulk.boundingBox(), add.boundingBox()])
  expect(Math.abs(r.y - a.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2)
  expect(a.height).toBeGreaterThanOrEqual(44)
  expect(await add.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(PRIMARY_BLUE)
  // Bulk Payment is a secondary action, not a second green primary.
  expect(await bulk.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(PRIMARY_BLUE)
})

test('a payment row keeps the amount beside a long customer name', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width >= 768, 'Mobile rows only')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  const name = page.locator('p.truncate').filter({ hasText: /gulfharvest|Walk-in/i }).first()
  await expect(name).toBeVisible()
  const amount = page.locator('p.whitespace-nowrap').filter({ hasText: 'AED' }).first()
  await expect(amount).toBeVisible()
  const [n, m] = await Promise.all([name.boundingBox(), amount.boundingBox()])
  expect(n.x + n.width).toBeLessThanOrEqual(m.x + 1)
})
