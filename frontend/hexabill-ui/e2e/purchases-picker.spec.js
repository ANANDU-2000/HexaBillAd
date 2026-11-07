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
  // The typed text is kept so several matching products can be added in a row.
  await expect(input).toHaveValue('a')
})

test('pick focuses Qty, Enter goes to Unit cost then back to search; re-pick marks Added and does not duplicate', async ({ page }) => {
  const input = await openPicker(page, 'a')
  const option = page.getByRole('listbox').getByRole('option').first()
  await expect(option).toBeVisible()
  await option.dispatchEvent('pointerdown')
  await expect(page.getByRole('listbox')).toHaveCount(0)

  const qty = page.locator('input[type="number"]:visible').first()
  await expect(qty).toBeFocused()
  await page.keyboard.type('3')
  await expect(qty).toHaveValue('3') // default 1 was selected, so typing replaced it
  await page.keyboard.press('Enter')
  const cost = page.locator('input[type="number"]:visible').nth(1)
  await expect(cost).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('a')

  // Same product again: badge shown, qty incremented, still one row.
  const again = page.getByRole('listbox').getByRole('option').first()
  await expect(again).toContainText('Added (Qty: 3)')
  await again.dispatchEvent('pointerdown')
  await expect(page.locator('input[type="number"]:visible').first()).toHaveValue('4')
})

test('typing never shows the unfiltered list: every option matches the term', async ({ page }) => {
  const input = await openPicker(page, '')
  await input.pressSequentially('nat', { delay: 30 })
  const options = page.getByRole('listbox').getByRole('option')
  for (let i = 0; i < 10; i++) {
    const texts = await options.allTextContents()
    expect(texts.every((t) => /nat/i.test(t))).toBe(true)
    await page.waitForTimeout(60)
  }
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
