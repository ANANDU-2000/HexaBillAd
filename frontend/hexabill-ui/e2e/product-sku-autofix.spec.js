import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function openForm (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add product', exact: true }).filter({ visible: true }).click()
  return page.getByRole('dialog').filter({ has: page.locator('input[name="nameEn"]') }).or(page.locator('form').filter({ has: page.locator('input[name="nameEn"]') })).first()
}

test('a SKU typed with a space is fixed for the user and saved once', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-8)
  const form = await openForm(page)
  await form.locator('input[name="nameEn"]').fill(`QA Beef ${stamp}`)
  await form.locator('input[name="sku"]').fill(`QABEEF ${stamp}gm`)
  await form.locator('input[name="costPrice"]').fill('120')
  await form.locator('input[name="sellPrice"]').fill('140')
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/products$/.test(r.url()))
  await form.getByRole('button', { name: 'Create Product', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  const body = await response.json()
  expect(body.data.sku).toBe(`QABEEF-${stamp}gm`)
})

test('an empty SKU is filled from the English name', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-8)
  const form = await openForm(page)
  await form.locator('input[name="nameEn"]').fill(`QA Fish ${stamp}`)
  await expect(form.locator('input[name="sku"]')).toHaveValue(`QA-FISH-${stamp}`)
  await form.locator('input[name="costPrice"]').fill('10')
  await form.locator('input[name="sellPrice"]').fill('12')
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/products$/.test(r.url()))
  await form.getByRole('button', { name: 'Create Product', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  expect((await response.json()).data.sku).toBe(`QA-FISH-${stamp}`)
})
