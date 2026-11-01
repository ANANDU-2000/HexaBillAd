// Catalogue-only products (imported names/units/SKUs, inactive, stock 0) — local synthetic data only.
// Precondition: tools/HexaBill.CatalogueImport applied to the FH2 test tenant (see checkpoint doc).
import { test, expect } from '@playwright/test'
import { signIn, apiLogin, feOrigin, API, EDGE } from './session.js'

const FH2 = process.env.HEXABILL_E2E_SLUG_FH2 || 'frozenhub2-test'
const NAME = process.env.HEXABILL_E2E_CATALOGUE_NAME || 'BEEF SLICE KAMIL 18KG'
const SHOTS = process.env.HEXABILL_E2E_SHOTS || ''

async function api (slug, method, path, body) {
  const { token } = await apiLogin(slug)
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test('imported catalogue item is listed under Inactive with zero stock, hidden from POS search, and cannot be sold', async ({ page }, info) => {
  await signIn(page, FH2)
  await page.goto(`${feOrigin(FH2)}/products`, { waitUntil: 'networkidle' })

  // Not in the active list…
  const search = page.getByPlaceholder(/^Search products/).locator('visible=true').first()
  await search.fill(NAME)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(NAME, { exact: true }).locator('visible=true')).toHaveCount(0)

  // …but present under Inactive, so the owner can price and activate it.
  const inactiveTab = page.getByRole('tab', { name: /^Inactive/ })
  await expect(inactiveTab).toContainText(/\d{3}/) // real server count, not the page-local 0
  await inactiveTab.click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(NAME, { exact: true }).locator('visible=true').first()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/catalogue-inactive-${info.project.name}.png` })

  // Server truth: tenant-scoped, stock 0, no price, inactive.
  const list = await api(FH2, 'GET', `/api/products?inactiveOnly=true&search=${encodeURIComponent(NAME)}&pageSize=5`)
  expect(list.status).toBe(200)
  const item = list.json.data.items.find((p) => p.nameEn === NAME)
  expect(item).toBeTruthy()
  expect(item.stockQty).toBe(0)
  expect(item.sellPrice).toBe(0)
  expect(item.isActive).toBe(false)

  // POS product search never offers it.
  const pos = await api(FH2, 'GET', `/api/products/search?q=${encodeURIComponent(NAME)}`)
  expect(pos.status).toBe(200)
  const posItems = Array.isArray(pos.json?.data) ? pos.json.data : (pos.json?.data?.items || [])
  expect(posItems.find((p) => p.nameEn === NAME)).toBeUndefined()

  // A direct API sale is refused: inactive, and also unpriced.
  const line = { productId: item.id, unitType: item.unitType, qty: 1 }
  const unpriced = await api(FH2, 'POST', '/api/sales', { items: [{ ...line, unitPrice: 0 }] })
  expect(unpriced.status).toBe(400)
  expect(JSON.stringify(unpriced.json)).toMatch(/is inactive/)
  expect(JSON.stringify(unpriced.json)).toMatch(/no selling price/)
  const priced = await api(FH2, 'POST', '/api/sales', { items: [{ ...line, unitPrice: 25 }] })
  expect(priced.status).toBe(400)
  expect(JSON.stringify(priced.json)).toMatch(/is inactive/)
  expect(JSON.stringify(priced.json)).not.toMatch(/no selling price/)
})
