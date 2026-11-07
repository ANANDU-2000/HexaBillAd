// Product picker on quotation lines: pick a real catalogue product, a custom item from the picker, and a free-typed
// item; save, reload, print, delete. Guards the "click description -> product list" workflow.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('quotation lines: pick catalogue product, custom item, typed item; save, print, delete', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/quotations/new`, { waitUntil: 'networkidle' })
  const mobile = page.viewportSize().width < 768
  const unique = `PICK${Date.now().toString(36).toUpperCase()}`
  await page.getByPlaceholder(/Customer or company name/).fill(`${unique} Customer`)

  const card = (i) => page.getByRole('list', { name: 'Line items' }).getByRole('listitem').nth(i)
  const desc = (i) => (mobile ? card(i).getByLabel(/description/) : page.locator(`[data-quote-cell="${i}-description"]`))
  const qty = (i) => (mobile ? card(i).getByLabel('Qty') : page.locator(`[data-quote-cell="${i}-qty"]`))
  const price = (i) => (mobile ? card(i).getByLabel('Price') : page.locator(`[data-quote-cell="${i}-unitPrice"]`))
  const drawer = page.locator('[data-quote-product-picker="overlay"]')
  const addRow = () => (mobile
    ? page.getByRole('button', { name: 'Add another item' }).click()
    : page.getByRole('button', { name: 'Add', exact: true }).click())

  // 1) Clicking an empty description opens the product list; picking a product fills name + price + unit.
  await desc(0).click()
  await expect(drawer).toBeVisible()
  const firstProduct = drawer.getByRole('dialog').locator('button:has(p.font-medium)').first()
  await expect(firstProduct).toBeVisible({ timeout: 15000 })
  const productName = (await firstProduct.locator('p.font-medium').innerText()).trim()
  await firstProduct.click()
  await expect(drawer).toBeHidden()
  await expect(desc(0)).toHaveValue(productName)
  await qty(0).fill('3')
  if (!(Number(await price(0).inputValue()) > 0)) await price(0).fill('25')

  // 2) Custom item through the picker ("Use ... as a custom item").
  await addRow()
  await desc(1).click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('searchbox').fill(`${unique} custom thing`)
  await drawer.getByRole('button', { name: /as a custom item/ }).click()
  await expect(drawer).toBeHidden()
  await expect(desc(1)).toHaveValue(`${unique} custom thing`)
  await price(1).fill('12.5')

  // 3) Typed text + Enter in the picker search uses it as a custom item when nothing matches.
  await addRow()
  await desc(2).click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('searchbox').fill(`${unique} typed`)
  await expect(drawer.getByText('No products found')).toBeVisible({ timeout: 15000 })
  await page.keyboard.press('Enter')
  await expect(drawer).toBeHidden()
  await expect(desc(2)).toHaveValue(`${unique} typed`)
  await price(2).fill('7')

  // 4) The picker still opens from the search button on a row that already has text.
  if (mobile) await card(2).getByRole('button', { name: 'Search products' }).click()
  else await page.getByTitle('Search products').nth(2).click()
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  const saveBtn = page.getByRole('button', { name: /Save changes|Saved|Saving/ })
  if (await saveBtn.isEnabled()) await saveBtn.click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 20000 })
  await page.waitForURL(/\/quotations\/\d+$/)
  const quoteNo = (await page.locator('main').innerText()).match(/Quote-\d+/)?.[0]
  expect(quoteNo).toBeTruthy()

  await page.reload({ waitUntil: 'networkidle' })
  await expect(desc(0)).toHaveValue(productName)
  await expect(qty(0)).toHaveValue('3')
  await expect(desc(1)).toHaveValue(`${unique} custom thing`)
  await expect(desc(2)).toHaveValue(`${unique} typed`)
  await expect(price(1)).toHaveValue('12.5')

  // Print opens the PDF tab.
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /Print Full/ }).click()])
  await expect.poll(() => popup.url(), { timeout: 20000 }).toMatch(/^blob:/)
  await popup.close()

  // Delete.
  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  page.once('dialog', (d) => d.accept())
  if (mobile) await page.getByLabel(`Delete ${quoteNo}`).click()
  else await page.getByRole('row').filter({ hasText: quoteNo }).getByTitle('Delete').click()
  await expect(page.getByText(quoteNo, { exact: true }).locator('visible=true')).toHaveCount(0, { timeout: 15000 })
})
