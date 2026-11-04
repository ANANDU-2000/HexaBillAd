// Quotation end to end on a synthetic local tenant: add several items, save, reload, edit, print, validate, delete.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('quotation: multi-item create, edit, print, validation, delete', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/quotations/new`, { waitUntil: 'networkidle' })
  const mobile = page.viewportSize().width < 768

  // No page-level sideways scrolling at any width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

  await page.getByPlaceholder(/Customer or company name/).fill('E2E Multi Item Customer')
  await page.getByPlaceholder('15-digit TRN').fill('100000000000003')
  await page.getByPlaceholder(/Supply of frozen meat/).fill('E2E subject')

  const rows = [
    ['E2E ITEM ONE', '2', '10'],
    ['E2E ITEM TWO', '3', '20'],
    ['E2E ITEM THREE', '4', '30'],
  ]
  const fillRow = async (i, [name, qty, price]) => {
    if (mobile) {
      const card = page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(i)
      await card.getByLabel(/description/).fill(name)
      await card.getByLabel('Qty').fill(qty)
      await card.getByLabel('Price').fill(price)
    } else {
      await page.locator(`[data-quote-cell="${i}-description"]`).fill(name)
      await page.locator(`[data-quote-cell="${i}-qty"]`).fill(qty)
      await page.locator(`[data-quote-cell="${i}-unitPrice"]`).fill(price)
    }
  }
  const addRow = async () => {
    if (mobile) await page.getByRole('button', { name: 'Add another item' }).click()
    else await page.getByRole('button', { name: 'Add', exact: true }).click()
  }

  await fillRow(0, rows[0])
  // Let auto-save fire between rows: this is what used to wipe a freshly added row.
  await page.waitForTimeout(2500)
  await addRow()
  await page.waitForTimeout(2500)
  await fillRow(1, rows[1])
  await addRow()
  await fillRow(2, rows[2])

  const saveBtn = page.getByRole('button', { name: /Save changes|Saved|Saving/ })
  await expect(saveBtn).toBeVisible()
  if (await saveBtn.isEnabled()) await saveBtn.click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 })
  await page.waitForURL(/\/quotations\/\d+$/)
  const quoteNo = (await page.locator('main').innerText()).match(/Quote-\d+/)?.[0]
  expect(quoteNo).toBeTruthy()

  // Reload: all three rows must be persisted, in order.
  await page.reload({ waitUntil: 'networkidle' })
  const names = mobile
    ? page.getByRole('list', { name: 'Line items' }).getByLabel(/description/)
    : page.locator('[data-quote-cell$="-description"]')
  await expect(names).toHaveCount(3)
  await expect(names.nth(0)).toHaveValue('E2E ITEM ONE')
  await expect(names.nth(2)).toHaveValue('E2E ITEM THREE')
  await expect(page.getByPlaceholder('15-digit TRN')).toHaveValue('100000000000003')

  // Edit: change a quantity, save, reload.
  if (mobile) {
    await page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(1).getByLabel('Qty').fill('9')
  } else {
    await page.locator('[data-quote-cell="1-qty"]').fill('9')
  }
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 })
  await page.reload({ waitUntil: 'networkidle' })
  if (mobile) {
    await expect(page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(1).getByLabel('Qty')).toHaveValue('9')
  } else {
    await expect(page.locator('[data-quote-cell="1-qty"]')).toHaveValue('9')
  }

  // Validation: a described row with a zero price is flagged and not saved.
  await addRow()
  if (mobile) {
    await page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(3).getByLabel(/description/).fill('E2E ZERO PRICE')
  } else {
    await page.locator('[data-quote-cell="3-description"]').fill('E2E ZERO PRICE')
  }
  await expect(page.getByRole('alert').filter({ hasText: 'Price must be greater than 0' })).toBeVisible()

  // Print opens a tab (popup-safe) showing the PDF.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Print Full/ }).click(),
  ])
  await expect(page.getByRole('alert').filter({ hasText: 'Item 4' })).toBeVisible()
  await popup.close()

  // Fix the price, then verify the PDF endpoint returns a real PDF.
  if (mobile) {
    await page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(3).getByLabel('Price').fill('5')
  } else {
    await page.locator('[data-quote-cell="3-unitPrice"]').fill('5')
  }
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 })
  const [popup2] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Print Full/ }).click(),
  ])
  await expect.poll(() => popup2.url(), { timeout: 20000 }).toMatch(/^blob:/)
  await popup2.close()

  // Delete from the list.
  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  page.once('dialog', (d) => d.accept())
  if (mobile) await page.getByLabel(`Delete ${quoteNo}`).click()
  else await page.getByRole('row').filter({ hasText: quoteNo }).getByTitle('Delete').click()
  await expect(page.getByText(quoteNo, { exact: true })).toHaveCount(0, { timeout: 15000 })
})
