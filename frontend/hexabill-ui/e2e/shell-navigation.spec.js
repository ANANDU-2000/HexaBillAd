// M1 shell regression (UX-S01, UX-S02, UX-S05). Local dev tenants only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const isPhone = (info) => info.project.use.viewport.width < 768
const bottomNav = (page) => page.locator('nav[aria-label="Main navigation"]')

test('browsing screen: one menu entry point, quick-create opens a create form', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  if (isPhone(info)) {
    await expect(bottomNav(page)).toBeVisible()
    await expect(bottomNav(page).getByRole('button', { name: 'More options' })).toBeVisible()
    // The hamburger duplicated "More": it must not be shown while the bottom nav is.
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0)
    await bottomNav(page).getByRole('button', { name: 'Create new' }).click()
    const sheet = page.getByRole('dialog', { name: 'Create' })
    await expect(sheet).toBeVisible()
    await expect(bottomNav(page)).toHaveCount(0) // hidden while a sheet is open
    await sheet.locator('[data-quick-create="expense"]').click()
  } else {
    await expect(bottomNav(page)).toBeHidden()
    await page.getByRole('button', { name: /^New/ }).click()
    await page.getByRole('menu', { name: 'Create' }).locator('[data-quick-create="expense"]').click()
  }
  await expect(page).toHaveURL(/\/expenses(?!.*new=1)/)
  await expect(page.getByRole('dialog').filter({ hasText: /Add New Expense/i })).toBeVisible()
  if (isPhone(info)) await expect(bottomNav(page)).toHaveCount(0) // form owns the screen
})

test('POS is a focused workspace on phones: no bottom nav, menu in the top bar, checkout at the bottom edge', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phone-only behaviour')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  await expect(bottomNav(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  const checkout = page.getByRole('button', { name: /checkout/i }).last()
  const box = await checkout.boundingBox()
  const vh = page.viewportSize().height
  expect(vh - (box.y + box.height)).toBeLessThan(40) // was ~90px: 65px nav underneath
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog').first()).toBeVisible() // grouped menu sheet
})

test('quick-create customer deep link opens Add Customer once and clears the flag', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers?new=1`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await expect(page).not.toHaveURL(/new=1/)
})

for (const [route, text] of [['/products', /add new product/i], ['/purchases', /purchase entry/i]]) {
  test(`quick-create deep link ${route}?new=1 opens its create form`, async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${route}?new=1`, { waitUntil: 'networkidle' })
    await expect(page.getByText(text).first()).toBeVisible()
    await expect(page).not.toHaveURL(/new=1/)
  })
}
