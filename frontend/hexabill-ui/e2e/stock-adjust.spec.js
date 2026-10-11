// Stock adjustment on a product: adjust up and down through the UI, confirm the stock through the API,
// refuse an adjustment without a reason, and show both entries in the stock history. The product is created
// through the API as test setup. Synthetic local tenant only.
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

async function stockOf (id) {
  const d = (await api(`/api/products/${id}`)).json.data
  return Number(d?.stockQty ?? d?.StockQty ?? d?.stock ?? NaN)
}

async function openAdjust (page, id, name) {
  await page.goto(`${feOrigin(SLUG)}/products/${id}`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Adjust stock', exact: true }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: /Adjust Stock/i }).first()
  await expect(dialog).toBeVisible()
  return dialog
}

test('stock adjustment: up, down, reason required, persisted and shown in the history', async ({ page }) => {
  const stamp = Date.now()
  const name = `UX Stock ${stamp}`
  const created = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ sku: `UX-STK-${stamp}`, nameEn: name, costPrice: 5, sellPrice: 8, unitType: 'PCS', conversionToBase: 1 }),
  })
  expect(created.status, `create product: ${JSON.stringify(created.json).slice(0, 200)}`).toBeLessThan(300)
  const id = created.json.data.id
  try {

    await signIn(page, SLUG)
    expect(await stockOf(id)).toBe(0)

    // A reason is required: nothing is sent without one.
    let posts = 0
    page.on('request', (r) => { if (r.method() === 'POST' && new RegExp(`/api/products/${id}/adjust-stock$`).test(r.url())) posts += 1 })
    let dialog = await openAdjust(page, id, name)
    await dialog.locator('input[name="changeQty"]').fill('5')
    await dialog.getByRole('button', { name: 'Adjust Stock', exact: true }).click()
    await expect(dialog.getByText(/reason for the stock adjustment/i).filter({ visible: true }).first()).toBeVisible()
    expect(posts).toBe(0)

    // Add 5 with a reason: the server stock becomes 5.
    await dialog.locator('textarea[name="reason"]').fill('Opening count (test)')
    const up = page.waitForResponse((r) => r.request().method() === 'POST' && new RegExp(`/api/products/${id}/adjust-stock$`).test(r.url()))
    await dialog.getByRole('button', { name: 'Adjust Stock', exact: true }).click()
    const upRes = await up
    if (upRes.status() >= 300) throw new Error(`adjust-stock ${upRes.status()}: ${await upRes.text()}`)
    await expect.poll(() => stockOf(id)).toBe(5)

    // Remove 2 with a reason: the server stock becomes 3.
    dialog = await openAdjust(page, id, name)
    await dialog.locator('input[name="changeQty"]').fill('-2')
    await dialog.locator('textarea[name="reason"]').fill('Damaged in store (test)')
    const down = page.waitForResponse((r) => r.request().method() === 'POST' && new RegExp(`/api/products/${id}/adjust-stock$`).test(r.url()))
    await dialog.getByRole('button', { name: 'Adjust Stock', exact: true }).click()
    const downRes = await down
    if (downRes.status() >= 300) throw new Error(`adjust-stock ${downRes.status()}: ${await downRes.text()}`)
    await expect.poll(() => stockOf(id)).toBe(3)

    // Both adjustments are in the stock history with their reasons.
    await page.goto(`${feOrigin(SLUG)}/stock-adjustments?productId=${id}`, { waitUntil: 'networkidle' })
    await expect(page.getByText('Opening count (test)').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('Damaged in store (test)').filter({ visible: true }).first()).toBeVisible()
  } finally {
    // Leave no active test product behind (they crowd the POS product drawer).
    await api(`/api/products/${id}`, { method: 'DELETE' })
  }
})
