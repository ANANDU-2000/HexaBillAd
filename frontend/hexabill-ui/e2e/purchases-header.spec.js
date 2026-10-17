// Purchases list header (PU-09): the title and the VAT Return link share one row on every width, and the bulk
// "claimable" action sits in the "…" menu. The bulk action is not run (it writes to every purchase).
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

test('purchase list header is one row; the bulk action is in the menu', async ({ page }) => {
  await signIn(page, (process.env.HEXABILL_E2E_SLUG || 'gulfharvest'))
  await page.goto(`${feOrigin((process.env.HEXABILL_E2E_SLUG || 'gulfharvest'))}/purchases`, { waitUntil: 'networkidle' })
  const title = page.getByRole('heading', { name: 'Purchase List', exact: true })
  const vat = page.getByRole('button', { name: 'VAT Return', exact: true }).filter({ visible: true }).first()
  await expect(title).toBeVisible()
  const t = await title.boundingBox()
  const v = await vat.boundingBox()
  expect(Math.abs((t.y + t.height / 2) - (v.y + v.height / 2)), 'title and VAT Return are on one row').toBeLessThan(12)
  await page.getByRole('button', { name: 'More list actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Mark VAT purchases as claimable' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'no page-level horizontal overflow').toBeLessThanOrEqual(0)
})
