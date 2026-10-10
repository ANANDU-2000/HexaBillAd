// M3 Billing History regression (UX-B01..B04) with realistic volume (local synthetic invoices).
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest'
const isPhone = (info) => info.project.use.viewport.width < 768

test('compact rows, row opens the invoice, Collect only while money is owed', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phone list layout')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/billing-history`, { waitUntil: 'networkidle' })
  const rows = page.locator('main ul.md\\:hidden > li')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThanOrEqual(10)
  for (const i of [0, 1, 2]) {
    const box = await rows.nth(i).boundingBox()
    expect(box.height).toBeLessThanOrEqual(72) // was 204px
  }
  // Each row: Collect is present exactly when its badge is not "Paid".
  const n = Math.min(await rows.count(), 10)
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i)
    const paid = await row.getByText('Paid', { exact: true }).count()
    await expect(row.getByRole('button', { name: 'Collect' })).toHaveCount(paid ? 0 : 1)
  }
  await rows.first().getByRole('button', { name: /^Open invoice/ }).click()
  await expect(page.getByRole('heading', { name: /^Invoice Preview/ })).toBeVisible()
})

test('search, date range and pagination work at volume', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/billing-history`, { waitUntil: 'networkidle' })
  const summary = page.getByText(/^Showing \d+ of \d+ invoices$/)
  await expect(summary).toBeVisible()
  const total = Number((await summary.innerText()).match(/of (\d+)/)[1])
  expect(total).toBeGreaterThan(20)

  // Pagination: all invoices fit one page by default; choose 10 rows per page, then the next page differs.
  await page.getByRole('combobox').filter({ has: page.locator('option[value="10"]') }).selectOption('10')
  await page.waitForLoadState('networkidle')
  const firstNo = async () => (isPhone(info)
    ? page.locator('main ul.md\\:hidden > li').first().locator('span.font-semibold').first().innerText()
    : page.locator('main tbody tr').first().locator('td').nth(1).innerText())
  const before = await firstNo()
  await page.getByRole('button', { name: /Next/ }).click()
  await page.waitForLoadState('networkidle')
  await expect.poll(firstNo).not.toBe(before)

  // Search narrows the list.
  // Search is debounced (300ms) and server-side: "0001" matches a few synthetic invoices, not all.
  await page.getByRole('searchbox', { name: 'Search invoices' }).fill('0001')
  await expect(summary).not.toHaveText(new RegExp(`of ${total} invoices$`))

  // Date range: phones open it from the calendar button; a future range empties the list.
  await page.getByRole('button', { name: 'Clear filters' }).click()
  if (isPhone(info)) await page.getByRole('button', { name: /^Date range:/ }).click()
  const from = isPhone(info) ? page.locator('#billing-date-range input[type="date"]').first() : page.locator('#bh-from-md')
  await from.fill('2099-01-01')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/^Showing 0 of 0 invoices$/)).toBeVisible()
})
