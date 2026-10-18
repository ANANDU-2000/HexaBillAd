// MOB-P1-2: on a phone the bill screen keeps branch, route and date in one summary line that opens a sheet,
// so "Add Product to Bill" and the sticky total are on the first screen. Nothing is saved. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('phone POS: details sheet replaces the branch/route/date row', async ({ page }) => {
  const vp = page.viewportSize()
  test.skip(vp.width >= 768, 'phone layout only')

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })

  const addToBill = page.getByRole('button', { name: 'Add Product to Bill', exact: true })
  await expect(addToBill).toBeVisible()
  const addBox = await addToBill.boundingBox()
  expect(addBox.y + addBox.height, 'Add Product to Bill is inside the first screen').toBeLessThanOrEqual(vp.height)
  // 6.5 rem of header above the cart was the problem; the toolbar must now be short.
  expect(addBox.y, 'cart action starts high on the screen').toBeLessThan(330)

  // The old inline controls are not on screen on a phone.
  await expect(page.getByTitle('Invoice date')).toBeHidden()
  await expect(page.getByTitle('Branch')).toBeHidden()

  const summary = page.getByRole('button', { name: /^Change branch, route and date/ })
  await expect(summary).toBeVisible()
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44)

  await summary.click()
  const sheet = page.getByRole('dialog', { name: 'Bill details' })
  await expect(sheet).toBeVisible()
  for (const control of await sheet.locator('select, input[type="date"]').all()) {
    const box = await control.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, 'control stays inside the screen').toBeLessThanOrEqual(vp.width)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  await sheet.locator('input[type="date"]').fill('2026-10-17')
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toBeHidden()
  await expect(summary).toContainText('17-10')

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

// Writes one sale into the synthetic tenant. Needs a product with stock: set HEXABILL_E2E_PRODUCT to its name.
test('phone POS: a route chosen in the sheet is what the saved sale carries', async ({ page }) => {
  const vp = page.viewportSize()
  test.skip(vp.width >= 768, 'phone layout only')
  test.skip(!process.env.HEXABILL_E2E_PRODUCT, 'set HEXABILL_E2E_PRODUCT to a stocked product name')

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /^Change branch, route and date/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Bill details' })
  const route = sheet.locator('select').nth(1)
  const options = await route.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
  test.skip(options.length === 0, 'the selected branch has no route')
  await route.selectOption(options[0])
  await sheet.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Add Product to Bill', exact: true }).click()
  await page.getByRole('button').filter({ hasText: process.env.HEXABILL_E2E_PRODUCT }).filter({ visible: true }).first().click()

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
  await page.getByRole('button', { name: /^Checkout$/ }).filter({ visible: true }).first().click()
  await page.getByRole('button', { name: /Save & Generate Invoice/ }).filter({ visible: true }).first().click()
  const res = await saved
  const body = await res.json().catch(() => ({}))
  expect(res.status(), JSON.stringify(body).slice(0, 300)).toBeLessThan(300)
  const sent = JSON.parse(res.request().postData() || '{}')
  expect(String(sent.routeId ?? sent.RouteId)).toBe(options[0])
})

test('wide POS keeps the inline branch, route and date controls', async ({ page }) => {
  test.skip(page.viewportSize().width < 768, 'wide layout only')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  await expect(page.getByTitle('Invoice date')).toBeVisible()
  await expect(page.getByTitle('Branch')).toBeVisible()
  await expect(page.getByTitle('Route')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Change branch, route and date/ })).toBeHidden()
})
