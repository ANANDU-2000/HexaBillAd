// Large quotation (22 rows) through the real UI, then list features: search, status filter, status change, copy, delete.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const setDesc = async (page, loc, text) => {
  await loc.click()
  const dr = page.locator('[data-quote-product-picker="overlay"]')
  await dr.getByRole('searchbox').fill(text)
  await dr.getByRole('button', { name: /as a custom item/ }).click()
  await expect(dr).toBeHidden()
}

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const N = 22

test('quotation with 22 items: create, reload, shrink, list search/filter/status/copy, delete', async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/quotations/new`, { waitUntil: 'networkidle' })
  const mobile = page.viewportSize().width < 768
  const unique = `BULK${Date.now().toString(36).toUpperCase()}`

  await page.getByPlaceholder(/Customer or company name/).fill(`${unique} Customer`)

  const card = (i) => page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(i)
  const fillRow = async (i) => {
    if (mobile) {
      await setDesc(page, card(i).getByLabel(/description/), `${unique} ITEM ${i + 1}`)
      await card(i).getByLabel('Qty').fill(String(i + 1))
      await card(i).getByLabel('Price').fill(String(10 + i))
    } else {
      await setDesc(page, page.locator(`[data-quote-cell="${i}-description"]`), `${unique} ITEM ${i + 1}`)
      await page.locator(`[data-quote-cell="${i}-qty"]`).fill(String(i + 1))
      await page.locator(`[data-quote-cell="${i}-unitPrice"]`).fill(String(10 + i))
    }
  }
  const addRow = () => (mobile
    ? page.getByRole('button', { name: 'Add another item' }).click()
    : page.getByRole('button', { name: 'Add', exact: true }).click())

  for (let i = 0; i < N; i++) {
    if (i > 0) await addRow()
    await fillRow(i)
    // Let auto-save run a few times mid-way: it must never drop or overwrite rows.
    if (i === 6 || i === 14) await page.waitForTimeout(2200)
  }

  const saveBtn = page.getByRole('button', { name: /Save changes|Saved|Saving/ })
  if (await saveBtn.isEnabled()) await saveBtn.click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 20000 })
  await page.waitForURL(/\/quotations\/\d+$/)
  const quoteNo = (await page.locator('main').innerText()).match(/Quote-\d+/)?.[0]
  expect(quoteNo).toBeTruthy()

  await page.reload({ waitUntil: 'networkidle' })
  const names = mobile
    ? page.getByRole('list', { name: 'Line items' }).getByLabel(/description/)
    : page.locator('[data-quote-cell$="-description"]')
  await expect(names).toHaveCount(N)
  await expect(names.nth(0)).toHaveValue(`${unique} ITEM 1`)
  await expect(names.nth(N - 1)).toHaveValue(`${unique} ITEM ${N}`)

  // Shrink: remove the last 5 rows, save, reload.
  for (let k = 0; k < 5; k++) {
    if (mobile) await page.getByRole('button', { name: `Remove item ${N - k}` }).click()
    else await page.getByRole('button', { name: 'Remove' }).last().click()
  }
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 20000 })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(names).toHaveCount(N - 5)

  // List: search, status filter, status change.
  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  await page.getByLabel('Search quotations').fill(unique)
  await expect(page.getByText(quoteNo, { exact: true }).locator('visible=true')).toHaveCount(1)
  await page.getByLabel('Filter by status').selectOption('Accepted')
  await expect(page.getByText('No quotations match your filters')).toBeVisible()
  await page.getByLabel('Filter by status').selectOption('')
  await expect(page.getByText(quoteNo, { exact: true }).locator('visible=true')).toHaveCount(1)
  const visibleStatus = page.getByLabel(`Status of ${quoteNo}`).locator('visible=true')
  await visibleStatus.selectOption('Sent')
  await expect(visibleStatus).toHaveValue('Sent')
  await page.getByLabel('Filter by status').selectOption('Sent')
  await expect(page.getByText(quoteNo, { exact: true }).locator('visible=true')).toHaveCount(1)

  // Copy: opens a new quotation prefilled with the same 17 rows; nothing is saved until edited.
  if (mobile) await page.getByLabel(`Copy ${quoteNo}`).click()
  else await page.getByRole('row').filter({ hasText: quoteNo }).getByTitle('Duplicate as a new quotation').click()
  await page.waitForURL(/\/quotations\/new\?copy=\d+/)
  const copyNames = mobile
    ? page.getByRole('list', { name: 'Line items' }).getByLabel(/description/)
    : page.locator('[data-quote-cell$="-description"]')
  await expect(copyNames).toHaveCount(N - 5)
  await expect(copyNames.nth(0)).toHaveValue(`${unique} ITEM 1`)

  // Delete the original from the list.
  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  await page.getByLabel('Search quotations').fill(unique)
  page.once('dialog', (d) => d.accept())
  if (mobile) await page.getByLabel(`Delete ${quoteNo}`).click()
  else await page.getByRole('row').filter({ hasText: quoteNo }).getByTitle('Delete').click()
  await expect(page.getByText(quoteNo, { exact: true }).locator('visible=true')).toHaveCount(0, { timeout: 15000 })
})
