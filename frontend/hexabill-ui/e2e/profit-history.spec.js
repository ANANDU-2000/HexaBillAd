// Profit & Margin Inspector: dashboard Profit card opens /profit-history, date filters work,
// an invoice row expands to the product-level price vs cost table, no horizontal overflow or trapped scroll.
// Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

const noHorizontalOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

test('profit card opens the inspector; filters and row expansion work', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Profit (Today|)|Period Profit/i }).first().click()
  await expect(page).toHaveURL(/\/profit-history\?preset=today/)
  await expect(page.getByRole('heading', { name: 'Profit & Margin Inspector' })).toBeVisible()
  await expect(page.getByText('Net Sales (Excl. VAT)')).toBeVisible()
  await expect(page.getByText('Verified Purchase Cost Basis')).toBeVisible()

  for (const label of ['Yesterday', 'This Week', 'This Month', 'Last Month']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Net Sales (Excl. VAT)')).toBeVisible()
    await noHorizontalOverflow(page)
  }

  await page.getByRole('button', { name: 'Custom Date', exact: true }).click()
  await expect(page.getByLabel('From', { exact: true })).toBeVisible()
  await expect(page.getByLabel('To', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'This Month', exact: true }).click()

  // Seeded bills are not guaranteed to fall in the current month: open a wide custom range (UAE dates).
  const dubaiToday = new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10)
  const yearAgo = new Date(Date.now() + 4 * 3600 * 1000 - 360 * 86400000).toISOString().slice(0, 10)
  await page.goto(`${feOrigin(SLUG)}/profit-history?preset=custom&from=${yearAgo}&to=${dubaiToday}`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Net Sales (Excl. VAT)')).toBeVisible()
  const expandButtons = page.getByRole('button', { name: /^Expand invoice/ })
  if (await expandButtons.count()) {
    await expandButtons.first().click()
    await expect(page.getByRole('button', { name: /View \/ Print Invoice PDF/ })).toBeVisible()
    await expect(page.getByText('Purchase Cost', { exact: true }).first()).toBeVisible()
    await noHorizontalOverflow(page)
    // no inner scroll trap: the page itself scrolls
    expect(await page.evaluate(() => [...document.querySelectorAll('table, table *')].filter((el) => el.scrollHeight > el.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)).length)).toBe(0)
  }
  await page.screenshot({ path: `test-results/profit-history-${page.viewportSize().width}.png`, fullPage: true })
})
