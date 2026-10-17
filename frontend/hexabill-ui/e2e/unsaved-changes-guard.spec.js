// Leaving an editor with typed, unsaved text asks first. Declining keeps the page and the text; accepting leaves.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('agreement editor: in-app navigation with unsaved text asks, decline keeps the text, accept leaves', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/agreements/new`, { waitUntil: 'networkidle' })
  const name = page.locator('[data-agr-field="name"]')
  await expect(name).toBeVisible()

  // Nothing typed yet: navigating away does not prompt.
  let prompts = 0
  page.on('dialog', async (d) => { prompts += 1; await (d.message().includes('unsaved') ? (prompts === 1 ? d.dismiss() : d.accept()) : d.dismiss()) })

  await name.fill('Unsaved Party LLC')
  const nav = page.getByRole('link', { name: 'Customers', exact: true }).first()
  await nav.click()
  await expect.poll(() => prompts).toBe(1)
  await expect(page).toHaveURL(/\/agreements\/new/)
  await expect(name).toHaveValue('Unsaved Party LLC')

  // Second attempt: accepted, so the app leaves the editor.
  await nav.click()
  await expect.poll(() => prompts).toBe(2)
  await expect(page).toHaveURL(/\/customers/)
})

test('agreement editor: a clean form does not prompt', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/agreements/new`, { waitUntil: 'networkidle' })
  let prompts = 0
  page.on('dialog', async (d) => { prompts += 1; await d.dismiss() })
  await page.getByRole('link', { name: 'Customers', exact: true }).first().click()
  await expect(page).toHaveURL(/\/customers/)
  expect(prompts).toBe(0)
})
