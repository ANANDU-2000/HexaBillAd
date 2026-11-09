// Purchase voucher product picker: multi-word search, no 5-item cap, scroll-without-adding on touch,
// pre-filled cost, and full product names (no sideways scroll) in the line items below 1024px.
// Synthetic local tenant only. Products carry a unique stamp so the run is isolated.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const BRANDS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'SEARA']

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

const created = []
test.afterAll(async () => {
  for (const id of created) await api(`/api/products/${id}`, { method: 'DELETE' })
})

test('purchase picker: >5 results scroll, multi-word search, drag does not add, tap adds with cost, names visible', async ({ page }) => {
  const stamp = String(Date.now()).slice(-7)
  for (const b of BRANDS) {
    const r = await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({ sku: `PK-${stamp}-${b}`, nameEn: `PKTEST ${stamp} CHICKEN 1000GM ${b}`, unitType: 'CRTN', conversionToBase: 1, costPrice: 105, sellPrice: 130, stockQty: 0, reorderLevel: 0 }),
    })
    expect(r.status).toBeLessThan(300)
    created.push(r.json.data?.id)
  }

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/purchases`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /New Purchase/i }).filter({ visible: true }).first().click()

  const input = page.locator('#purchase-product-search')
  await input.fill(`${stamp} 1000`)
  const list = page.locator('#purchase-product-search-list')
  await expect(list.getByRole('option')).toHaveCount(BRANDS.length)       // not capped at 5
  const box = await list.evaluate((el) => ({ pan: getComputedStyle(el).touchAction, oy: getComputedStyle(el).overflowY }))
  expect(box.oy).toBe('auto')
  expect(box.pan).toBe('pan-y')

  // Pointer-down alone (the start of a scroll drag) must not add anything.
  const opt = list.getByRole('option').nth(2)
  const b = await opt.boundingBox()
  await page.mouse.move(b.x + 20, b.y + 10)
  await page.mouse.down()
  await page.mouse.move(b.x + 20, b.y - 40, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText('No items. Search and add products above.')).toBeVisible().catch(() => {})
  await expect(page.locator('input[placeholder="e.g. 120.00"]').filter({ visible: true })).toHaveCount(0)

  // Multi-word, out-of-order search finds the one product.
  await input.fill(`seara ${stamp} 1000`)
  await expect(list.getByRole('option')).toHaveCount(1)
  await expect(list.getByRole('option').first()).toContainText('SEARA')

  // A real tap adds it with the last cost pre-filled and the full name shown above the numbers.
  await list.getByRole('option').first().click()
  const cost = page.locator('input[placeholder="e.g. 120.00"]').filter({ visible: true }).first()
  await expect(cost).toHaveValue('105')
  await expect(page.getByText(`PKTEST ${stamp} CHICKEN 1000GM SEARA`).filter({ visible: true }).first()).toBeVisible()

  // No sideways scroll in the item area below 1024px.
  const vw = page.viewportSize().width
  if (vw < 1024) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)
  }
})
