// UX-02: the price list never hides product identity behind sideways scrolling on a phone,
// and the edit control sits next to the name. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('price list: no horizontal scroll on phones, identity beside edit, inline edit usable', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pricelist`, { waitUntil: 'networkidle' })
  const vp = page.viewportSize()
  const phone = vp.width < 768

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page has no horizontal overflow').toBeLessThanOrEqual(1)

  if (phone) {
    const first = page.getByRole('list', { name: 'Price list' }).getByRole('listitem').first()
    await expect(first).toBeVisible()
    const edit = first.getByRole('button', { name: /^Edit price for / })
    await expect(edit).toBeVisible()
    const box = await edit.boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(43)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    await edit.click()
    const input = first.getByRole('spinbutton')
    await expect(input).toBeVisible()
    await expect(first.getByRole('button', { name: 'Cancel price edit' })).toBeVisible()
    await first.getByRole('button', { name: 'Cancel price edit' }).click()
    await expect(input).toHaveCount(0)
  } else {
    await expect(page.getByRole('columnheader', { name: 'Product Name' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Price list' })).toBeHidden()
  }
})
