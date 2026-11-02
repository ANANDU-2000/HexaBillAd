// Billing History — one unified list (current + read-only historical invoices).
// Local synthetic data only. FH1 slug must hold synthetic historical rows (see docs: unified billing QA);
// FH2 slug must hold none.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const FH1 = process.env.HEXABILL_E2E_SLUG || 'frozenhub1-test'
const FH2 = process.env.HEXABILL_E2E_SLUG_FH2 || 'frozenhub2-test'
const SHOTS = process.env.HEXABILL_E2E_SHOTS || ''
const isPhone = (info) => info.project.use.viewport.width < 768

const summary = (page) => page.locator('main p[aria-live="polite"]')
const countOf = async (page) => {
  await expect(summary(page)).toHaveText(/^[\d,]+ invoices?$/)
  return Number((await summary(page).innerText()).replace(/[^\d]/g, ''))
}
const rows = (page, info) => (isPhone(info) ? page.locator('main ul.md\\:hidden > li') : page.locator('main tbody tr'))
const firstNumber = (page, info) => rows(page, info).first().locator(isPhone(info) ? 'span.font-semibold' : 'td').nth(isPhone(info) ? 0 : 1).innerText()

test('deprecated ?tab=operating opens the full combined history, not 3 operating invoices', async ({ page }, info) => {
  await signIn(page, FH1)
  await page.goto(`${feOrigin(FH1)}/billing-history`, { waitUntil: 'networkidle' })
  const full = await countOf(page)
  expect(full).toBeGreaterThanOrEqual(33) // 3 operating + 30 historical (synthetic)

  for (const tab of ['operating', 'legacy', 'all']) {
    await page.goto(`${feOrigin(FH1)}/billing-history?tab=${tab}&search=`, { waitUntil: 'networkidle' })
    await expect(page).not.toHaveURL(/[?&]tab=/)
    expect(await countOf(page)).toBe(full)
  }
  // No source tabs, no archive wording in the normal workflow.
  await expect(page.getByRole('button', { name: /Legacy Starplus|FrozenHub Invoices|All History/ })).toHaveCount(0)
  await expect(page.getByText(/Starplus|Archive/i)).toHaveCount(0)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/billing-history-${info.project.name}.png`, fullPage: false })
})

test('historical invoices are searchable, read-only and open their original details', async ({ page }, info) => {
  await signIn(page, FH1)
  await page.goto(`${feOrigin(FH1)}/billing-history?search=6975`, { waitUntil: 'networkidle' })
  await expect(rows(page, info)).toHaveCount(1)
  if (isPhone(info)) {
    await page.getByRole('button', { name: 'Actions for 6975' }).click()
    await expect(page.getByRole('menuitem', { name: /Edit invoice|Delete invoice/ })).toHaveCount(0)
    await page.getByRole('menuitem', { name: /View invoice/ }).click()
  } else {
    await expect(page.getByRole('button', { name: 'Edit invoice 6975' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete invoice 6975' })).toHaveCount(0)
    await page.getByRole('button', { name: 'View invoice 6975' }).click()
  }
  await expect(page.getByText('#6975')).toBeVisible()
})

test('status, period and pagination filter the same server-side list', async ({ page }, info) => {
  await signIn(page, FH1)
  await page.goto(`${feOrigin(FH1)}/billing-history`, { waitUntil: 'networkidle' })
  const full = await countOf(page)

  // Pagination: 20 rows per page; page 2 starts with a different invoice and the total does not change.
  const before = await firstNumber(page, info)
  await page.getByRole('button', { name: /Next/ }).click()
  await page.waitForLoadState('networkidle')
  await expect.poll(() => firstNumber(page, info)).not.toBe(before)
  expect(await countOf(page)).toBe(full)
  await expect(page).toHaveURL(/page=2/)

  // Status partitions add up to the whole list.
  const counts = {}
  for (const s of ['paid', 'partial', 'unpaid']) {
    await page.getByLabel('Payment status').selectOption(s)
    await page.waitForLoadState('networkidle')
    counts[s] = await countOf(page)
    await expect(page).toHaveURL(new RegExp(`status=${s}`))
  }
  expect(counts.paid + counts.partial + counts.unpaid).toBe(full)
  // Unpaid rows never show a Paid badge.
  const unpaidBadges = await rows(page, info).getByText('Paid', { exact: true }).count()
  expect(unpaidBadges).toBe(0)

  // Voided lists deleted invoices only.
  await page.getByLabel('Payment status').selectOption('voided')
  await page.waitForLoadState('networkidle')
  await expect(rows(page, info).filter({ hasText: '5999' })).toHaveCount(1)
  await page.getByLabel('Payment status').selectOption('all')

  // Custom future range: nothing, with an honest empty state (no AED 0 totals).
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  await page.locator('#bh-from').fill('2099-01-01')
  await page.locator('#bh-to').fill('2099-01-02')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('No invoices found')).toBeVisible()

  // Back restores the previous filter state.
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.waitForLoadState('networkidle')
  expect(await countOf(page)).toBe(full)
})

test('a tenant without history sees only its own invoices', async ({ page }, info) => {
  await signIn(page, FH2)
  await page.goto(`${feOrigin(FH2)}/billing-history?tab=legacy`, { waitUntil: 'networkidle' })
  await expect(page).not.toHaveURL(/[?&]tab=/)
  const n = await countOf(page)
  expect(n).toBeLessThan(33)
  await page.getByRole('searchbox', { name: 'Search invoices' }).fill('6975')
  await expect(page.getByText('No invoices found')).toBeVisible()
  await expect(page.locator('main svg[aria-label="Original invoice, read-only"]')).toHaveCount(0)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/billing-history-fh2-${info.project.name}.png` })
})
