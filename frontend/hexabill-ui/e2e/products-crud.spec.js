// Products: create through the form, confirm through the API, refresh, edit the selling price, confirm again,
// and deactivate with the typed confirmation. Each step is checked against the API. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

// The list row for one product: the smallest element that holds its name and an action button.
const rowFor = (page, name, action) => page.locator('tr, li, article, div')
  .filter({ hasText: name })
  .filter({ has: page.getByRole('button', { name: action, exact: true }) })
  .last()

async function productBySku (sku) {
  const list = items((await api('/api/products?page=1&pageSize=200')).json)
  return list.find((p) => p.sku === sku) || null
}

test('product: create -> persisted -> refresh -> edit price -> persisted -> deactivate (typed confirmation)', async ({ page }, info) => {
  const stamp = Date.now()
  const sku = `UX-SKU-${stamp}`
  const name = `UX Product ${stamp}`
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })

  // CREATE
  await page.getByRole('button', { name: /^Add product$/i }).filter({ visible: true }).first().click()
  const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await expect(form.locator('input[name="nameEn"]')).toBeVisible()
  await form.locator('input[name="sku"]').fill(sku)
  await form.locator('input[name="nameEn"]').fill(name)
  await form.locator('input[name="costPrice"]').fill('12.50')
  await form.locator('input[name="sellPrice"]').fill('20.00')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/products$/.test(r.url()))
  await form.getByRole('button', { name: 'Create Product' }).click()
  const createdRes = await created
  if (createdRes.status() >= 300) throw new Error(`POST /api/products ${createdRes.status()}: ${await createdRes.text()}`)

  await expect.poll(async () => (await productBySku(sku))?.sellPrice).toBe(20)
  const product = await productBySku(sku)
  expect(product.nameEn).toBe(name)
  expect(product.costPrice).toBe(12.5)

  // REFRESH: the product is listed with its name.
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  // Desktop and tablet rows carry "Edit Product"; phone cards carry "Edit <product name>".
  const phoneCards = info.project.use.viewport.width < 768
  const editControl = phoneCards
    ? page.getByRole('button', { name: `Edit ${name}`, exact: true }).filter({ visible: true }).first()
    : rowFor(page, name, 'Edit Product').filter({ visible: true }).getByRole('button', { name: 'Edit Product', exact: true })
  await expect(editControl).toBeVisible()

  // EDIT: the selling price becomes 22.75 (from this product's row).
  await editControl.click()
  const editForm = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await expect(editForm.locator('input[name="nameEn"]')).toHaveValue(name)
  await editForm.locator('input[name="sellPrice"]').fill('22.75')
  const updated = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/products\//.test(r.url()))
  await editForm.getByRole('button', { name: 'Update Product' }).click()
  const updatedRes = await updated
  if (updatedRes.status() >= 300) throw new Error(`PUT /api/products ${updatedRes.status()}: ${await updatedRes.text()}`)
  await expect.poll(async () => (await productBySku(sku))?.sellPrice).toBe(22.75)

  // DEACTIVATE: a typed confirmation is required; inactive in the API afterwards.
  // Desktop and tablet: from this product's row in the list. Phones: from the product detail page (no deactivate on phone cards).
  const phone = info.project.use.viewport.width < 768
  if (phone) {
    await page.goto(`${feOrigin(SLUG)}/products/${product.id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Deactivate', exact: true }).filter({ visible: true }).first().click()
  } else {
    await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
    await rowFor(page, name, 'Deactivate Product').filter({ visible: true }).getByRole('button', { name: 'Deactivate Product', exact: true }).click()
  }
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  const confirm = dialog.getByRole('button', { name: /deactivate/i }).last()
  await expect(confirm).toBeDisabled()
  await dialog.locator('input').first().fill('DEACTIVATE')
  await expect(confirm).toBeEnabled()
  const deactivated = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/products\//.test(r.url()))
  await confirm.click()
  const deactivatedRes = await deactivated
  expect(deactivatedRes.status()).toBeLessThan(300)
  // The list hides inactive products, so read this product by id.
  const byId = async () => (await api(`/api/products/${product.id}`)).json.data
  await expect.poll(async () => (await byId())?.isActive).toBe(false)
  void info
})
