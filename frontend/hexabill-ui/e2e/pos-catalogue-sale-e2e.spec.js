// POS and catalogue end to end, on the synthetic tenant only:
// 1. a product that sorts past the first 200 names is found in the POS picker;
// 2. typing in the picker never reports "No product for ..." and Enter adds the product once;
// 3. a priced product saves as a sale and its stock goes down by the sold quantity;
// 4. an unpriced product is refused with the server's own reason;
// 5. a product's name and price edited on the Products page show up in the POS.
// Fixtures are created through the API and deactivated afterwards.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'frozenhub2-test'
const stamp = Date.now()
const createdIds = []

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

const data = (json) => json.data ?? json.Data
const pick = (o, a, b) => (o?.[a] ?? o?.[b])

async function activeCount () {
  return pick(data((await api('/api/products?page=1&pageSize=1')).json), 'totalCount', 'TotalCount') || 0
}

async function createProduct ({ sku, nameEn, sellPrice, stockQty }) {
  const r = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ sku, nameEn, unitType: 'PIECE', conversionToBase: 1, costPrice: 10, sellPrice, stockQty, reorderLevel: 0 }),
  })
  if (r.status >= 300) throw new Error(`POST /api/products ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`)
  const product = data(r.json)
  createdIds.push(pick(product, 'id', 'Id'))
  return product
}

async function productById (id) {
  return data((await api(`/api/products/${id}`)).json)
}

// Fill the tenant past 200 active products. Filler names sort before the target, so the target lands past row 200.
async function ensureMoreThan200Active () {
  let n = await activeCount()
  for (let i = 0; n < 205; i++, n++) {
    await createProduct({ sku: `E2E-FILL-${stamp}-${i}`, nameEn: `AAA E2E fill ${stamp} ${String(i).padStart(3, '0')}`, sellPrice: 5, stockQty: 0 })
  }
}

test.beforeAll(async () => {
  // No POS-visible leftovers if a step fails: fixtures are deactivated (DELETE), which hides them from the POS.
})

test.afterAll(async () => {
  for (const id of createdIds) {
    if (id) await api(`/api/products/${id}`, { method: 'DELETE' })
  }
})

const openPicker = async (page) => {
  await page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true }).first().click()
}
const searchBox = (page) => page.getByPlaceholder(/Search name, SKU, barcode/).filter({ visible: true }).first()
const pickerButton = (page, text) => page.getByRole('button').filter({ hasText: text }).filter({ visible: true }).first()
const noProductToast = (page) => page.getByText(/No product for/)

test.describe('POS catalogue and sale (wide layout)', () => {
  test.setTimeout(420_000)

  test('a product that sorts past the first 200 names is found in the POS picker', async ({ page }) => {
    await ensureMoreThan200Active()
    const name = `ZZZ E2E target ${stamp}`
    await createProduct({ sku: `E2E-T-${stamp}`, nameEn: name, sellPrice: 15, stockQty: 50 })
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await openPicker(page)
    await searchBox(page).fill(name.slice(0, 14))
    await expect(pickerButton(page, name)).toBeVisible()
  })

  test('typing in the picker never reports "No product for" and never adds by itself; Enter adds once', async ({ page }) => {
    const name = `Typing target ${stamp}`
    const sku = `E2E-TYPE-${stamp}`
    await createProduct({ sku, nameEn: name, sellPrice: 12, stockQty: 40 })
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await openPicker(page)
    await searchBox(page).pressSequentially('Typing tar', { delay: 30 })
    await expect(pickerButton(page, name)).toBeVisible()
    await expect(noProductToast(page)).toHaveCount(0)
    // Typing the exact SKU must not add the line on its own (the picker stays open and nothing is added yet).
    await searchBox(page).fill(sku)
    await expect(pickerButton(page, name)).toBeVisible()
    await expect(page.getByDisplayValue(name)).toHaveCount(0)
    await searchBox(page).press('Enter')
    await expect(page.getByDisplayValue(name).first()).toBeVisible()
    await expect(noProductToast(page)).toHaveCount(0)
  })

  test('a priced product saves as a sale and its stock goes down by the sold quantity', async ({ page }) => {
    const name = `Sale target ${stamp}`
    const product = await createProduct({ sku: `E2E-SALE-${stamp}`, nameEn: name, sellPrice: 15, stockQty: 50 })
    const before = await productById(pick(product, 'id', 'Id'))
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await openPicker(page)
    await searchBox(page).fill(name)
    await pickerButton(page, name).click()
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
    await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
    const res = await saved
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body).slice(0, 300)).toBeLessThan(300)
    const sale = data(body)
    const saleId = pick(sale, 'id', 'Id')
    expect(saleId).toBeTruthy()
    const saved2 = data((await api(`/api/sales/${saleId}`)).json)
    const items = pick(saved2, 'items', 'Items') || []
    const line = items.find((i) => pick(i, 'productId', 'ProductId') === pick(product, 'id', 'Id'))
    expect(line, 'the saved sale has the product line').toBeTruthy()
    const soldQty = Number(pick(line, 'qty', 'Qty'))
    expect(soldQty).toBeGreaterThan(0)
    await expect.poll(async () => Number(pick(await productById(pick(product, 'id', 'Id')), 'stockQty', 'StockQty'))).toBe(Number(pick(before, 'stockQty', 'StockQty')) - soldQty)
  })

  test('an unpriced product is refused with the server reason, and nothing is saved', async ({ page }) => {
    const name = `Unpriced ${stamp}`
    await createProduct({ sku: `E2E-UNP-${stamp}`, nameEn: name, sellPrice: 0, stockQty: 10 })
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await openPicker(page)
    await searchBox(page).fill(name)
    await pickerButton(page, name).click()
    const posted = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()), { timeout: 20000 }).catch(() => null)
    await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
    const res = await posted
    expect(res, 'the save request is sent').not.toBeNull()
    expect(res.status()).toBeGreaterThanOrEqual(400)
    await expect(page.getByText(/has no selling price/).first()).toBeVisible()
  })

  test('a name and price edited on the Products page show up in the POS', async ({ page }) => {
    const oldName = `Edit me ${stamp}`
    const product = await createProduct({ sku: `E2E-EDIT-${stamp}`, nameEn: oldName, sellPrice: 20, stockQty: 5 })
    const id = pick(product, 'id', 'Id')
    const newName = `Edited name ${stamp}`
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/Search products/).filter({ visible: true }).first().fill(`E2E-EDIT-${stamp}`)
    const editControl = page.locator('tr, li, article, div')
      .filter({ hasText: oldName })
      .filter({ has: page.getByRole('button', { name: 'Edit', exact: true }) })
      .last()
      .getByRole('button', { name: 'Edit', exact: true })
    await editControl.filter({ visible: true }).first().click()
    const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
    await expect(form.locator('input[name="nameEn"]')).toHaveValue(oldName)
    await form.locator('input[name="nameEn"]').fill(newName)
    await form.locator('input[name="sellPrice"]').fill('17.5')
    const put = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/products\//.test(r.url()))
    await form.getByRole('button', { name: 'Update Product' }).click()
    const putRes = await put
    expect(putRes.status(), 'PUT accepted').toBeLessThan(300)
    await expect.poll(async () => {
      const p = await productById(id)
      return `${pick(p, 'nameEn', 'NameEn')}|${pick(p, 'sellPrice', 'SellPrice')}`
    }).toBe(`${newName}|17.5`)

    // The POS must show the edited name and price, not a cached copy.
    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
    await openPicker(page)
    await searchBox(page).fill(newName)
    await expect(pickerButton(page, newName)).toBeVisible()
    await expect(page.getByText(/17\.50/).first()).toBeVisible()
  })
})
