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

// Leave no active test product behind if a step fails (they crowd the POS product drawer).
let createdSku = null
test.afterEach(async () => {
  if (!createdSku) return
  const p = await productBySku(createdSku)
  if (p && p.isActive !== false) await api(`/api/products/${p.id}`, { method: 'DELETE' })
  createdSku = null
})

test('product: create -> persisted -> refresh -> edit price -> persisted -> deactivate (typed confirmation)', async ({ page }, info) => {
  const stamp = Date.now()
  const sku = `UX-SKU-${stamp}`
  createdSku = sku
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
  // From 1280px the list is a table whose rows carry "Edit Product"; below that it is cards that carry "Edit <product name>".
  const width = info.project.use.viewport.width
  const phoneCards = width < 1280
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
  // Phones: from the product detail page. Wider: from the row/card "…" menu.
  if (width < 768) {
    await page.goto(`${feOrigin(SLUG)}/products/${product.id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Deactivate', exact: true }).filter({ visible: true }).first().click()
  } else {
    // Table rows (1280px and up) and cards (768-1279px) both open the same "More actions" menu.
    await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).filter({ visible: true }).first().click()
    await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click()
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
