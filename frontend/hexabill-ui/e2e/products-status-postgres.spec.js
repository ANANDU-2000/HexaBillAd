// Real status/bulk flow against disposable loopback API and PostgreSQL only.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { API, EDGE, apiLogin, feOrigin, signIn } from './session.js'

test.use({ trace: 'off' })
test.setTimeout(120_000)
const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (route, init = {}) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(API).hostname)) throw new Error('Disposable loopback API required')
  const session = await apiLogin(SLUG)
  const response = await fetch(API + route, { ...init, headers: { Authorization: `Bearer ${session.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' } })
  const body = await response.json()
  expect(response.ok, `Synthetic API ${route}: ${response.status}`).toBeTruthy()
  return body.data
}

function stored (id) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid synthetic id')
  return JSON.parse(execFileSync('C:/Program Files/PostgreSQL/18/bin/psql.exe', ['-h', '127.0.0.1', '-p', '55433', '-U', 'qa_local', '-d', 'hexabill_staging', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT row_to_json(p) FROM "Products" p WHERE "Id"=${id}`], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: '', PGSSLMODE: 'disable', PGOPTIONS: '-c default_transaction_read_only=on' } }))
}

test('inactive pages and real bulk deactivate/reactivate preserve identity and stock', async ({ page }) => {
  const prefix = `QA-STATUS-${Date.now()}`
  const ids = []
  const requests = []
  page.on('request', request => {
    if (request.method() === 'DELETE' || (request.method() === 'POST' && request.url().endsWith('/activate'))) requests.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  try {
    for (let i = 0; i < 23; i++) {
      const item = await api('/api/products', { method: 'POST', body: JSON.stringify({ sku: `${prefix}-${i}`, nameEn: `${prefix} ${i < 12 ? 'A' : 'I'}${String(i).padStart(2, '0')}`, unitType: 'PCS', conversionToBase: 1, costPrice: 5, sellPrice: 8 }) })
      ids.push(item.id)
      if (i >= 12) await api(`/api/products/${item.id}`, { method: 'DELETE' })
    }
    await api(`/api/products/${ids[0]}/adjust-stock`, { method: 'POST', body: JSON.stringify({ changeQty: 5.5, reason: 'Synthetic status regression opening balance' }) })
    const session = await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/products`)
    const search = page.getByRole('searchbox', { name: /Search products/ }).or(page.getByRole('textbox', { name: /Search products/ })).filter({ visible: true }).first()
    await search.fill(prefix)
    for (const i of [0, 1]) await page.getByRole('checkbox', { name: `Select ${prefix} A${String(i).padStart(2, '0')}`, exact: true }).filter({ visible: true }).check()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const confirm = dialog.getByRole('button', { name: 'Deactivate 2', exact: true })
    await expect(confirm).toBeDisabled()
    await dialog.locator('input').fill('DEACTIVATE')
    await confirm.click()
    await expect(page.getByText('2 products deactivated', { exact: true })).toBeVisible()
    for (const id of ids.slice(0, 2)) {
      const row = stored(id)
      expect(row.TenantId).toBe(session.user.tenantId)
      expect(row.IsActive).toBe(false)
    }
    expect(stored(ids[0]).StockQty).toBe(5.5)

    const listed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/products' && new URL(response.url()).searchParams.get('inactiveOnly') === 'true')
    await page.getByRole('tab', { name: /^Inactive/ }).click()
    const first = (await (await listed).json()).data
    expect(first.totalCount).toBe(13)
    expect(first.items).toHaveLength(10)
    expect(first.items.every(item => !item.isActive)).toBe(true)
    await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible()
    const next = page.waitForResponse(response => new URL(response.url()).pathname === '/api/products' && new URL(response.url()).searchParams.get('page') === '2')
    await page.getByRole('button', { name: 'Next', exact: true }).filter({ visible: true }).click()
    const last = (await (await next).json()).data
    expect(last.totalCount).toBe(13)
    expect(last.items).toHaveLength(3)
    expect(last.items.every(item => !item.isActive)).toBe(true)
    expect(new Set([...first.items, ...last.items].map(item => item.id)).size).toBe(13)
    await page.getByRole('button', { name: 'Previous', exact: true }).filter({ visible: true }).click()
    for (const i of [0, 1]) await page.getByRole('checkbox', { name: `Select ${prefix} A${String(i).padStart(2, '0')}`, exact: true }).filter({ visible: true }).check()
    await page.getByRole('button', { name: 'Activate', exact: true }).filter({ visible: true }).first().click()
    await expect(page.getByText('2 products activated', { exact: true })).toBeVisible()
    for (const id of ids.slice(0, 2)) expect(stored(id).IsActive).toBe(true)
    expect(stored(ids[0]).StockQty).toBe(5.5)
    expect(stored(ids[0]).Sku).toBe(`${prefix}-0`)
    for (const id of ids.slice(0, 2)) {
      expect(requests.filter(request => request === `DELETE /api/products/${id}`)).toHaveLength(1)
      expect(requests.filter(request => request === `POST /api/products/${id}/activate`)).toHaveLength(1)
    }
    await page.reload()
    await page.getByRole('tab', { name: 'All Products', exact: true }).click()
    await search.fill(prefix)
    await expect(page.getByRole('checkbox', { name: `Select ${prefix} A00`, exact: true }).filter({ visible: true })).toBeVisible()
  } finally {
    for (const id of ids) await api(`/api/products/${id}`, { method: 'DELETE' })
  }
})
