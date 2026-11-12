// T4 hunt 2: two tabs on one record, browser back during save, refresh mid-form, slow 3G, command palette.
// Run with project d1440 only. Synthetic tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function api (path, method = 'GET', body) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, data: json.data, json }
}
const items = (d) => d?.items || d?.Items || d || []

async function openEditProduct (page, name) {
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Search products/).filter({ visible: true }).first().fill(name)
  const row = page.locator('tr').filter({ hasText: name }).first()
  await row.getByRole('button', { name: 'Edit', exact: true }).click()
  const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await expect(form.locator('input[name="nameEn"]')).toHaveValue(name)
  return form
}

test('BUG-42 two tabs: a stale product edit in tab 2 does not silently overwrite the price saved from tab 1', async ({ browser }) => {
  const st = Date.now(); const name = `HF Two Tabs ${st}`
  const p = (await api('/api/products', 'POST', { sku: `HF-2T-${st}`, nameEn: name, unitType: 'PIECE', conversionToBase: 1, costPrice: 5, sellPrice: 15 })).data
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const a = await ctx.newPage(); const b = await ctx.newPage()
  try {
    await signIn(a, SLUG); await signIn(b, SLUG)
    const formA = await openEditProduct(a, name)
    const formB = await openEditProduct(b, name)
    await formA.locator('input[name="sellPrice"]').fill('30')
    const resA = a.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/products\//.test(r.url()))
    await formA.getByRole('button', { name: 'Update Product' }).click(); await resA
    // Tab 2 still shows the old price 15 and only changes the Arabic name.
    await formB.locator('input[name="nameAr"]').fill('اختبار').catch(() => {})
    const resB = b.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/products\//.test(r.url()))
    await formB.getByRole('button', { name: 'Update Product' }).click(); const rb = await resB
    const now = (await api(`/api/products/${p.id}`)).data
    expect(rb.status() >= 400 || Number(now.sellPrice) === 30, `tab 2 saved ${rb.status()} and the price is now ${now.sellPrice}: tab 1's change to 30 was lost without a conflict warning`).toBe(true)
  } finally {
    await ctx.close(); await api(`/api/products/${p.id}`, 'DELETE')
  }
})

test('browser back while a product save is in flight: no duplicate product and no blank page', async ({ page }) => {
  const st = Date.now(); const sku = `HF-BK-${st}`
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.route('**/api/products', async (route) => { if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 2000)); await route.continue() })
  await page.getByRole('button', { name: /^Add product$/i }).filter({ visible: true }).first().click()
  const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await form.locator('input[name="sku"]').fill(sku); await form.locator('input[name="nameEn"]').fill(`HF back ${st}`)
  await form.locator('input[name="costPrice"]').fill('5'); await form.locator('input[name="sellPrice"]').fill('9')
  await form.getByRole('button', { name: 'Create Product' }).click()
  await page.goBack()
  await page.waitForTimeout(3500)
  const found = items((await api(`/api/products?page=1&pageSize=50&search=${sku}`)).data).filter((p) => p.sku === sku)
  for (const p of found) await api(`/api/products/${p.id}`, 'DELETE')
  const text = (await page.locator('body').innerText()).trim()
  // Inconclusive about saved=0 (the in-flight POST is cancelled by the full-document back navigation). Only duplicates and blank pages are asserted.
  expect({ saved: found.length <= 1, blank: text.length < 40 }).toEqual({ saved: true, blank: false })
})

test('BUG-43 refresh in the middle of the Add Product form warns before discarding typed data (beforeunload)', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Add product$/i }).filter({ visible: true }).first().click()
  const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await form.locator('input[name="nameEn"]').fill('Half typed product')
  let warned = false
  page.on('dialog', async (d) => { if (d.type() === 'beforeunload') warned = true; await d.accept() })
  await page.reload({ waitUntil: 'networkidle' })
  expect(warned, 'full refresh with typed data gave no beforeunload warning').toBe(true)
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(40)
})

test('BUG-44 slow 3G: Payments, Products and POS reach network idle within 45 s with no page errors', async ({ page, context }) => {
  test.setTimeout(240_000)
  await signIn(page, SLUG)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)))
  const result = {}
  for (const route of ['/payments', '/products', '/pos']) {
    const t0 = Date.now()
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'commit' })
    await page.waitForTimeout(1500)
    const early = (await page.locator('body').innerText()).trim().length
    await page.waitForLoadState('networkidle', { timeout: 60_000 })
    result[route] = { earlyChars: early, totalMs: Date.now() - t0 }
  }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  test.info().annotations.push({ type: 'slow3g', description: JSON.stringify(result) })
  expect(errors).toEqual([])
  for (const [route, r] of Object.entries(result)) {
    expect(r.totalMs, `${route} took ${r.totalMs} ms on slow 3G`).toBeLessThan(45_000)
  }
})

test('command palette: Ctrl+K opens, typing filters, Enter navigates, Escape closes; works from inside a form field', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.keyboard.press('Control+k')
  const input = page.getByRole('dialog').getByRole('textbox').or(page.locator('input[placeholder*="Search" i]:visible, input[placeholder*="command" i]:visible')).first()
  await expect(input).toBeVisible()
  await input.fill('payments')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/payments/)
  await page.keyboard.press('Control+k')
  await expect(input).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(input).toBeHidden()
  // From inside a text field
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Search products/).filter({ visible: true }).first().focus()
  await page.keyboard.press('Control+k')
  await expect(input).toBeVisible()
})

test('a lazy page chunk that fails to load (stale deploy / flaky network) shows a recovery screen, not a blank page', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.route(/features\/reports\/|assets\/Reports/, (route) => route.abort())
  await page.evaluate(() => { window.history.pushState({}, '', '/reports'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForTimeout(2500)
  const text = (await page.locator('main, #root').first().innerText()).trim()
  expect(/reload|retry|try again|something went wrong|could not load|refresh/i.test(text), `no recovery message; visible text: "${text.slice(0, 80)}"`).toBe(true)
})
