import { test, expect } from '@playwright/test'
import { signIn, feOrigin, API, EDGE } from './session.js'

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

test('messy values are fixed, explained and saved', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-8)
  const form = await openForm(page)
  await form.locator('input[name="nameEn"]').fill(`   QA   Beef    ${stamp}  `)
  await form.locator('input[name="costPrice"]').fill('120.456')
  await form.locator('input[name="sellPrice"]').fill('140')
  await form.locator('input[name="conversionToBase"]').fill('1')
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/products$/.test(r.url()))
  await form.getByRole('button', { name: 'Create Product', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  const data = (await response.json()).data
  expect(data.nameEn).toBe(`QA Beef ${stamp}`)
  expect(data.costPrice).toBe(120.46)
  expect(data.conversionToBase).toBe(1)
})

test('a lost server answer after a product was saved is shown as uncertain without resending', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-8)
  const form = await openForm(page)
  let posts = 0
  await page.route(/\/api\/products$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    await route.fetch({
      url: `${API}/api/products`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await form.locator('input[name="nameEn"]').fill(`QA Lost ${stamp}`)
  await form.locator('input[name="costPrice"]').fill('5')
  await form.locator('input[name="sellPrice"]').fill('9')
  await form.getByRole('button', { name: 'Create Product', exact: true }).click()
  await expect(page.getByText(/Save status is uncertain/)).toBeVisible()
  await expect(form).toBeVisible()
  await expect(page.getByText(/Failed to create product/)).toHaveCount(0)
  expect(posts).toBe(1)
})
