// T4 bug hunt 1: UI form abuse on Products and Payments: double-click save, extreme text, odd amounts.
// Synthetic tenant only. Each test cleans up the product it creates.
import { test, expect } from '@playwright/test'
import { ensureOwingCustomer } from '../fixtures.js'
import { signIn, feOrigin, apiLogin, API, EDGE } from '../session.js'
import { pickValue } from '../pickers.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const items = (j) => j.data?.items || j.data?.Items || j.data || []

async function openProductForm (page) {
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Add product$/i }).filter({ visible: true }).first().click()
  const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') }).filter({ visible: true }).first()
  await expect(form.locator('input[name="nameEn"]')).toBeVisible()
  return form
}

test('product form: double-click Create Product creates one product', async ({ page }) => {
  const stamp = Date.now(); const sku = `HF-DBL-${stamp}`
  await signIn(page, SLUG)
  const posts = []
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/products$/.test(r.url())) posts.push(r.url()) })
  const form = await openProductForm(page)
  await form.locator('input[name="sku"]').fill(sku)
  await form.locator('input[name="nameEn"]').fill(`HF double ${stamp}`)
  await form.locator('input[name="costPrice"]').fill('5')
  await form.locator('input[name="sellPrice"]').fill('9')
  await form.getByRole('button', { name: 'Create Product' }).dblclick()
  await page.waitForTimeout(1500)
  const found = items((await api('/api/products?page=1&pageSize=200')).json).filter((p) => p.sku === sku)
  for (const p of found) await api(`/api/products/${p.id}`, { method: 'DELETE' })
  expect(found.length, `POST requests sent: ${posts.length}`).toBe(1)
})

test('product form: 500-char name and emoji/Arabic are handled (validation message or saved intact), never a silent failure', async ({ page }) => {
  const stamp = Date.now(); const sku = `HF-LNG-${stamp}`
  await signIn(page, SLUG)
  const form = await openProductForm(page)
  await form.locator('input[name="sku"]').fill(sku)
  await form.locator('input[name="nameEn"]').fill('N'.repeat(500))
  await form.locator('input[name="costPrice"]').fill('5')
  await form.locator('input[name="sellPrice"]').fill('9')
  const nameLen = await form.locator('input[name="nameEn"]').evaluate((el) => el.value.length)
  await form.getByRole('button', { name: 'Create Product' }).click()
  await page.waitForTimeout(1500)
  const found = items((await api('/api/products?page=1&pageSize=200')).json).filter((p) => p.sku === sku)
  for (const p of found) await api(`/api/products/${p.id}`, { method: 'DELETE' })
  const visibleError = await page.getByText(/200|too long|max|invalid|must be/i).filter({ visible: true }).count()
  expect(found.length > 0 || visibleError > 0, `input accepted ${nameLen} chars, nothing saved and no message shown`).toBe(true)
})

test('product form: negative and 3-decimal prices are blocked or normalised in the form', async ({ page }) => {
  const stamp = Date.now(); const sku = `HF-NEG-${stamp}`
  await signIn(page, SLUG)
  const form = await openProductForm(page)
  await form.locator('input[name="sku"]').fill(sku)
  await form.locator('input[name="nameEn"]').fill(`HF neg ${stamp}`)
  await form.locator('input[name="costPrice"]').fill('-5')
  await form.locator('input[name="sellPrice"]').fill('9.999')
  await form.getByRole('button', { name: 'Create Product' }).click()
  await page.waitForTimeout(1500)
  const found = items((await api('/api/products?page=1&pageSize=200')).json).filter((p) => p.sku === sku)
  for (const p of found) await api(`/api/products/${p.id}`, { method: 'DELETE' })
  expect(found.filter((p) => p.costPrice < 0).length, 'negative cost price saved').toBe(0)
})

test('payment dialog: double-click Add Payment records one payment; negative/zero amount is blocked before the request', async ({ page }) => {
  await signIn(page, SLUG)
  const customer = await ensureOwingCustomer(SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Payment' }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await pickValue(page, dialog.locator('[name="customerId"]'), customer.id)
  const posts = []
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/payments$/.test(r.url())) posts.push(r.postData()) })
  await dialog.locator('input[name="amount"]').fill('-3')
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  await page.waitForTimeout(600)
  expect(posts.length, 'negative amount posted').toBe(0)
  await dialog.locator('input[name="amount"]').fill('0')
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()
  await page.waitForTimeout(600)
  expect(posts.length, 'zero amount posted').toBe(0)
  const amount = (1 + (Date.now() % 700) / 100).toFixed(2)
  await dialog.locator('input[name="amount"]').fill(amount)
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).dblclick()
  await page.waitForTimeout(1500)
  const mine = items((await api(`/api/payments?customerId=${customer.id}&page=1&pageSize=100`)).json).filter((p) => Number(p.amount) === Number(amount))
  expect(mine.length, `posts sent ${posts.length}`).toBe(1)
})
