// Purchases list: collapsed filters on phones and tablets, status colours, expandable rows,
// failed-load recovery and the empty period. Needs the synthetic "UX-PI-" purchases seeded on the
// local tenant (see docs/uiux/PREMIUM-UX-TRACKER.md, Purchases). Local/dev only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest'
const isPurchaseList = (url) => url.pathname.endsWith('/api/purchases')
const visible = (locator) => locator.filter({ visible: true })
const RED_800 = 'rgb(153, 27, 27)'

async function openPurchases (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
}

test('filters sit behind one button below 1024px and the status filter applies', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width >= 1024, 'Filters are always open from 1024px')
  await openPurchases(page)
  const toggle = page.getByRole('button', { name: /^Filters/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(visible(page.getByRole('combobox', { name: 'Status' }))).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('combobox', { name: 'Status' }).selectOption('paid')
  await expect(page).toHaveURL(/status=paid/)
  // The count badge shows how many filters are active.
  await expect(toggle).toContainText('1')
})

test('overdue is red only when overdue purchases exist', async ({ page }) => {
  await openPurchases(page)
  const overdue = visible(page.getByRole('button', { name: /Overdue/ })).first()
  await expect(overdue).toBeVisible()
  const colour = await overdue.locator('span').last().evaluate((el) => getComputedStyle(el).color)
  // The seeded tenant has no overdue purchases, so the count must not be red.
  expect(colour).not.toBe(RED_800)
})

test('a purchase row stays compact and opens to its items and actions', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width >= 1280, 'Desktop uses the table, not the expandable rows')
  await openPurchases(page)
  const row = visible(page.locator('main button[aria-expanded]').filter({ hasText: 'UX-PI-' })).first()
  await expect(row).toHaveAttribute('aria-expanded', 'false')
  const card = row.locator('xpath=..')
  await expect(card.getByRole('button', { name: /^Edit$/ })).toHaveCount(0)
  await row.click()
  await expect(row).toHaveAttribute('aria-expanded', 'true')
  await expect(card.getByRole('button', { name: /^Edit$/ })).toBeVisible()
  await expect(card.getByRole('button', { name: /^Delete$/ })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Supplier ledger' })).toBeVisible()
})

test('a failed load shows an error with Try again, never an empty list', async ({ page }, info) => {
  await signIn(page, SLUG)
  let failing = true
  let calls = 0
  await page.route(isPurchaseList, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    calls += 1
    if (!failing) return route.continue()
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Server error' }) })
  })
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  const alert = visible(page.getByRole('alert')).filter({ hasText: 'Purchases could not be loaded' })
  await expect(alert).toHaveCount(1)
  await expect(visible(page.getByText('No purchases found'))).toHaveCount(0)
  failing = false
  const before = calls
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect.poll(() => calls).toBeGreaterThan(before)
  await expect(visible(page.getByRole('alert')).filter({ hasText: 'could not be loaded' })).toHaveCount(0)
  await expect(visible(page.locator('main').getByText('UX-PI-')).first()).toBeVisible()
})

test('an empty period explains why', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route(isPurchaseList, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], totalPages: 1, totalCount: 0, page: 1, pageSize: 10 } }),
    })
  })
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  await expect(visible(page.getByText('No purchases found'))).toHaveCount(1)
  await expect(visible(page.getByRole('alert')).filter({ hasText: 'could not be loaded' })).toHaveCount(0)
})
