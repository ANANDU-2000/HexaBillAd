// Products: an inactive product can be activated again from its detail page, and the product then shows as active in the API.
// The product is created and deactivated through the API for the setup, and left deactivated at the end. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

test('products: activate an inactive product from its detail page', async ({ page }) => {
  const stamp = Date.now()
  const created = await api('/api/products', { method: 'POST', body: JSON.stringify({ sku: `UX-ACT-${stamp}`, nameEn: `UX Activate ${stamp}`, costPrice: 5, sellPrice: 8, unitType: 'PCS', conversionToBase: 1 }) })
  expect(created.status, `create product: ${JSON.stringify(created.json).slice(0, 200)}`).toBeLessThan(300)
  const id = created.json.data.id
  try {
    expect((await api(`/api/products/${id}`, { method: 'DELETE' })).status, 'setup: deactivate').toBeLessThan(300)
    expect((await api(`/api/products/${id}`)).json.data.isActive, 'setup: inactive').toBe(false)

    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/products/${id}`, { waitUntil: 'networkidle' })
    const activate = page.getByRole('button', { name: 'Activate', exact: true }).filter({ visible: true }).first()
    await expect(activate).toBeVisible()
    const done = page.waitForResponse((r) => r.request().method() !== 'GET' && new RegExp(`/api/products/${id}/activate$`).test(r.url()))
    await activate.click()
    expect((await done).status()).toBeLessThan(300)
    await expect.poll(async () => (await api(`/api/products/${id}`)).json.data.isActive).toBe(true)
    // The page now offers Deactivate instead of Activate.
    await expect(page.getByRole('button', { name: 'Deactivate', exact: true }).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Activate', exact: true })).toHaveCount(0)
  } finally {
    await api(`/api/products/${id}`, { method: 'DELETE' })
  }
})
