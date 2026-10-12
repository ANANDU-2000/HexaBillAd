import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function headers () {
  const s = await apiLogin(SLUG)
  return { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' }
}
async function apiGet (path) { return (await (await fetch(`${API}${path}`, { headers: await headers() })).json()) }
const fieldAfter = (page, label) => page.locator('label', { hasText: label }).filter({ visible: true }).first().locator('xpath=following-sibling::input[1]')

async function prepare (page, stamp) {
  const supplier = `QA Purchase Supplier ${stamp}`
  const created = await fetch(`${API}/api/suppliers`, { method: 'POST', headers: await headers(), body: JSON.stringify({ name: supplier }) })
  expect(created.status).toBeLessThan(300)
  const products = await apiGet('/api/products?page=1&pageSize=20')
  const product = (products.data?.items || products.data || [])[0]
  expect(product, 'a product must exist').toBeTruthy()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^New Purchase$/ }).click()
  await expect(page.getByText('New Purchase Entry')).toBeVisible()
  await fieldAfter(page, 'Supplier Name').fill(supplier)
  await page.getByPlaceholder('Search products...').fill(product.nameEn)
  await page.getByText(product.nameEn, { exact: true }).filter({ visible: true }).first().click()
  const row = page.locator('table tbody tr').filter({ has: page.locator('input[type="number"]') }).first()
  return { supplier, row }
}

test('an empty invoice number is made for the client and a long cost is rounded', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 768, 'item table layout is covered at tablet and desktop')
  const stamp = `${Date.now()}`.slice(-7)
  const { supplier, row } = await prepare(page, stamp)
  await row.locator('input[type="number"]').nth(0).fill('5')
  await row.locator('input[type="number"]').nth(1).fill('20.456')
  const created = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/purchases$/.test(r.url()))
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  const response = await created
  if (response.status() >= 300) console.log('PURCHASE_FAIL', response.status(), (await response.text()).slice(0, 700))
  expect(response.status()).toBeLessThan(300)
  const sent = response.request().postDataJSON()
  expect(sent.invoiceNo).toMatch(/^PUR-\d{8}-\d{6}$/)
  expect(sent.items[0].unitCost).toBe(20.46)
  const list = await apiGet(`/api/purchases?page=1&pageSize=50&supplierName=${encodeURIComponent(supplier)}`)
  expect((list.data?.items || []).filter(p => p.supplierName === supplier)).toHaveLength(1)
})

test('a lost server answer after a purchase was saved is not shown as a failure and posts once', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 768, 'item table layout is covered at tablet and desktop')
  const stamp = `${Date.now()}`.slice(-7)
  const { supplier, row } = await prepare(page, stamp)
  const invoice = `QA-LOST-${stamp}`
  await fieldAfter(page, 'Invoice No').fill(invoice)
  await row.locator('input[type="number"]').nth(0).fill('2')
  await row.locator('input[type="number"]').nth(1).fill('10')
  let posts = 0
  await page.route(/\/api\/purchases$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    await route.fetch({
      url: `${API}/api/purchases`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await page.getByRole('button', { name: 'Save Purchase' }).click()
  await expect(page.getByText(/Purchase created!/).first()).toBeVisible()
  await expect(page.getByText(/Create failed/)).toHaveCount(0)
  expect(posts).toBe(1)
  const list = await apiGet(`/api/purchases?page=1&pageSize=50&supplierName=${encodeURIComponent(supplier)}`)
  expect((list.data?.items || []).filter(p => p.invoiceNo === invoice)).toHaveLength(1)
})
