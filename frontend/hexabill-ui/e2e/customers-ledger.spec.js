// M2 Customer Ledger regression (UX-L01/L02). Local dev tenants only; opens dialogs, does not post money.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
import { createOwingCustomer } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('ledger picker: search first, filters behind a toggle', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('searchbox', { name: 'Search customer' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Filter customers by branch' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByRole('combobox', { name: 'Filter customers by branch' })).toBeVisible()
})

test('customer with an open balance: receive payment, pay all and the action menu', async ({ page }, info) => {
  // Own data: a fresh customer with an unpaid invoice, so nothing depends on what the tenant already holds.
  const name = `QA ledger owing ${`${Date.now()}`.slice(-9)}`
  await createOwingCustomer(SLUG, name)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customer' }).fill(name)
  const owing = page.locator('main button').filter({ hasText: name }).first()
  await expect(owing).toBeVisible()
  await owing.click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: /Pay all/ })).toBeVisible()
  const menu = page.getByRole('button', { name: /^More actions for / })
  await menu.click()
  for (const item of ['Statement PDF', 'Pending bills PDF', 'Full ledger PDF', 'Share on WhatsApp', 'Send statement', 'Refresh', 'Reconcile']) {
    await expect(page.getByRole('menuitem', { name: new RegExp(item) })).toBeVisible()
  }
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /Receive payment/ }).click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  if (info.project.use.viewport.width < 768) {
    await expect(page.locator('nav[aria-label="Main navigation"]')).toHaveCount(0)
  }
})
