// POS: a sale reduces the product stock by the sold quantity, and a double click on save creates one sale only.
// Both are checked against the API (stock and the request count). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const PRODUCT = 'gulfharvest Sample Chicken 1kg'

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

async function productByName (name) {
  return items((await api('/api/products?page=1&pageSize=200')).json).find((p) => p.nameEn === name) || null
}

const stockOf = async (id) => Number((await api(`/api/products/${id}`)).json.data?.stockQty ?? NaN)

// Open the product drawer and pick the product, then fill the sale in the layout that is on screen.
async function addProductToSale (page) {
  const addRow = page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true })
  const addToBill = page.getByRole('button', { name: 'Add Product to Bill', exact: true }).filter({ visible: true })
  const wide = (await addRow.count()) > 0
  await (wide ? addRow : addToBill).first().click()
  await page.getByRole('button').filter({ hasText: PRODUCT }).filter({ visible: true }).first().click()
  return wide
}

test('POS sale: stock goes down by the sold quantity, as the server records it', async ({ page }) => {
  const product = await productByName(PRODUCT)
  expect(product, 'the sample product must exist on the local tenant').toBeTruthy()
  const before = await stockOf(product.id)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  const wide = await addProductToSale(page)

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/sales$/.test(r.url()))
  if (wide) {
    await page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first().click()
  } else {
    await page.getByRole('button', { name: /^Checkout$/ }).filter({ visible: true }).first().click()
    await page.getByRole('button', { name: /Save & Generate Invoice/ }).filter({ visible: true }).first().click()
  }
  const res = await saved
  if (res.status() >= 300) throw new Error(`POST /api/sales ${res.status()}: ${await res.text()}`)
  await expect.poll(() => stockOf(product.id)).toBe(before - 1)
})

test('POS sale: a double click on save creates one sale', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'networkidle' })
  const wide = await addProductToSale(page)

  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/sales$/.test(r.url())) posts += 1 })
  const save = wide
    ? page.getByRole('button', { name: 'Save Invoice', exact: true }).filter({ visible: true }).first()
    : page.getByRole('button', { name: /Save & Generate Invoice/ }).filter({ visible: true }).first()
  if (!wide) await page.getByRole('button', { name: /^Checkout$/ }).filter({ visible: true }).first().click()
  const responses = []
  page.on('response', (r) => { if (r.request().method() === 'POST' && /\/api\/sales$/.test(r.url())) responses.push(r.status()) })
  await save.dblclick()
  await expect.poll(() => responses.length, { timeout: 20_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  expect(posts, 'one save must send one sale request').toBe(1)
  expect(responses.filter((s) => s < 300).length).toBe(1)
})
