// UX-01: the purchase product picker is anchored to its input, stacks above the item table,
// stays inside the viewport, and selects by touch/keyboard. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function openPicker (page, term) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^New Purchase$/ }).click()
  const input = page.getByRole('combobox', { name: /add product/i })
  await input.scrollIntoViewIfNeeded()
  await input.fill(term)
  return input
}

test('list is anchored under the input, above the table, inside the viewport', async ({ page }) => {
  const input = await openPicker(page, 'a')
  const list = page.getByRole('listbox')
  await expect(list).toBeVisible()
  await page.waitForTimeout(800) // let the form's smooth scroll settle before measuring
  const i = await input.boundingBox()
  const l = await list.boundingBox()
  const vp = page.viewportSize()
  expect(Math.abs(l.x - i.x)).toBeLessThanOrEqual(2)
  expect(l.y - (i.y + i.height)).toBeLessThanOrEqual(8)
  expect(l.y).toBeGreaterThanOrEqual(i.y + i.height - 1)
  expect(l.x + l.width).toBeLessThanOrEqual(vp.width + 1)
  // The element at the list centre is the list (nothing from the item table paints over it).
  const topmost = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="listbox"]'), { x: l.x + l.width / 2, y: l.y + Math.min(20, l.height / 2) })
  expect(topmost).toBe(true)
})

test('keyboard selects a product and closes the list; Escape closes without adding', async ({ page }) => {
  const input = await openPicker(page, 'a')
  await expect(page.getByRole('listbox')).toBeVisible()
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(input).toHaveValue('')
})

test.describe('touch', () => {
  test.use({ hasTouch: true })
  test('tapping an option adds the product', async ({ page }) => {
    await openPicker(page, 'a')
    const option = page.getByRole('listbox').getByRole('option').first()
    await expect(option).toBeVisible()
    await option.tap()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.getByText('No items. Search and add products above.')).toHaveCount(0)
  })
})
