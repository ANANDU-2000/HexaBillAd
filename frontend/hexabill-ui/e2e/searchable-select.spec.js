// Searchable customer picker (shared Select with more than 8 options) in the Bulk Payment modal:
// it is the searchable variant, typing narrows the list, the keyboard picks, Esc closes only the
// dropdown (not the modal), and the list is not clipped by the modal. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
import { ensureCustomerCount } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('customer picker: search, keyboard, Esc, not clipped', async ({ page }) => {
  // More than 8 options switches the shared Select to the searchable picker.
  expect(await ensureCustomerCount(SLUG, 12)).toBeGreaterThan(8)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Bulk Payment', exact: true }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Bulk Payment Entry' }).first()
  await expect(dialog).toBeVisible()

  const trigger = dialog.getByRole('combobox', { name: 'Customer' })
  await expect(trigger, 'Customer field must be the searchable combobox').toBeVisible()
  // The modal moves focus to its first field ~100ms after opening; wait for that before interacting.
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await trigger.click()
  const search = page.getByRole('searchbox', { name: 'Search Customer' })
  await expect(search).toBeFocused()
  const options = page.getByRole('listbox').getByRole('option')
  const total = await options.count()
  expect(total).toBeGreaterThan(8)

  // The popover lies inside the viewport (portal, not clipped by the modal's scroll area).
  const box = await page.getByRole('listbox').boundingBox()
  const vp = page.viewportSize()
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)

  // Typing narrows the list; a nonsense query shows "No match".
  await search.fill('zzzz-no-such-customer')
  await expect(page.getByText('No match')).toBeVisible()
  await search.fill('Fixture')
  const narrowed = await options.count()
  expect(narrowed).toBeGreaterThan(0)
  expect(narrowed).toBeLessThan(total)

  // Esc closes the dropdown only; the modal stays open.
  await search.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(trigger).toBeFocused()

  // Keyboard: open, type, ArrowDown, Enter selects and shows the name on the trigger.
  await trigger.press('ArrowDown')
  await page.getByRole('searchbox', { name: 'Search Customer' }).fill('Fixture')
  const second = await page.getByRole('listbox').getByRole('option').nth(1).innerText()
  await page.getByRole('searchbox', { name: 'Search Customer' }).press('ArrowDown')
  await page.getByRole('searchbox', { name: 'Search Customer' }).press('Enter')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(trigger).toContainText(second.split('\n')[0].trim().slice(0, 12))
})
