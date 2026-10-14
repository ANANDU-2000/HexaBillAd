// Full form → real API → matched disposable PostgreSQL. Explicit loopback targets only.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { signIn, apiLogin, feOrigin, API, EDGE } from './session.js'

test.use({ trace: 'off' })
const SLUG = 'gulfharvest'

async function api (url, init = {}) {
  if (!['localhost', '127.0.0.1'].includes(new URL(API).hostname)) throw new Error('Disposable loopback API required')
  const session = await apiLogin(SLUG)
  const response = await fetch(API + url, { ...init, headers: { Authorization: `Bearer ${session.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' } })
  const body = await response.json()
  expect(response.ok, `API ${url} status ${response.status}`).toBeTruthy()
  return body.data
}

function databaseProduct (id) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid synthetic product id')
  return JSON.parse(execFileSync('C:/Program Files/PostgreSQL/18/bin/psql.exe', ['-h', '127.0.0.1', '-p', '55433', '-U', 'qa_local', '-d', 'hexabill_staging', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT row_to_json(p) FROM "Products" p WHERE "Id"=${id}`], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: '', PGSSLMODE: 'disable', PGOPTIONS: '-c default_transaction_read_only=on' } }))
}

test('every product form field persists, refreshes and edits without changing stock; image can be cleared', async ({ page }, info) => {
  const stamp = Date.now()
  const sku = `QA-FIELDS-${stamp}`
  let id
  const session = await signIn(page, SLUG)
  try {
    await page.goto(`${feOrigin(SLUG)}/products`)
    await page.getByRole('button', { name: 'Add product', exact: true }).filter({ visible: true }).first().click()
    const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') })
    await form.getByRole('button', { name: 'Create new category' }).click()
    await form.getByPlaceholder('New category name').fill(`QA Category ${stamp}`)
    await form.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(form.locator('[name="categoryId"]')).not.toHaveValue('')
    const categoryId = Number(await form.locator('[name="categoryId"]').inputValue())
    const values = { sku, barcode: `QA-BC-${stamp}`, nameEn: `Synthetic carton ${stamp}`, nameAr: 'منتج اختباري', conversionToBase: '1.2345', costPrice: '12.50', sellPrice: '19.75', reorderLevel: '7', expiryDate: '2030-12-31', descriptionEn: 'Synthetic English description', descriptionAr: 'وصف اختباري' }
    for (const [field, value] of Object.entries(values)) await form.locator(`[name="${field}"]`).fill(value)
    await form.locator('[name="unitType"]').selectOption('CRTN')
    await form.locator('input[type="file"]').setInputFiles(path.join(process.env.LOCALAPPDATA, 'HexaBillQA/20261013/synthetic-product.png'))
    const posted = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/products$/.test(r.url()))
    await form.getByRole('button', { name: 'Create Product', exact: true }).click()
    const response = await posted
    expect(response.status()).toBe(201)
    id = (await response.json()).data.id
    await expect(form).toBeHidden()
    const saved = await api(`/api/products/${id}`)
    expect(saved.imageUrl).toBeTruthy()
    const stored = databaseProduct(id)
    expect(stored.TenantId).toBe(session.user.tenantId)
    expect(stored.Sku).toBe(sku)
    expect(stored.NameAr).toBe(values.nameAr)
    expect(stored.Barcode).toBe(values.barcode)
    expect(stored.UnitType).toBe('CRTN')
    expect(stored.ConversionToBase).toBe(1.2345)
    expect(stored.CostPrice).toBe(12.5)
    expect(stored.SellPrice).toBe(19.75)
    expect(stored.ReorderLevel).toBe(7)
    expect(stored.ExpiryDate).toContain('2030-12-31')
    expect(stored.CategoryId).toBe(categoryId)
    expect(stored.DescriptionEn).toBe(values.descriptionEn)
    expect(stored.DescriptionAr).toBe(values.descriptionAr)
    expect(stored.ImageUrl).toBe(saved.imageUrl)
    expect(stored.StockQty).toBe(0)
    await api(`/api/products/${id}/adjust-stock`, { method: 'POST', body: JSON.stringify({ changeQty: 25.5, reason: 'Synthetic opening balance' }) })

    await page.goto(`${feOrigin(SLUG)}/products/${id}?edit=1`)
    const edit = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') })
    await expect(edit.locator('[name="reorderLevel"]')).toHaveValue('7')
    await expect(edit.locator('[name="conversionToBase"]')).toHaveValue('1.2345')
    await expect(edit.locator('[name="descriptionAr"]')).toHaveValue(values.descriptionAr)
    await expect.poll(() => edit.getByAltText('Product preview').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: info.outputPath('all-fields-reopened.png'), fullPage: true })
    const changed = { sku: `${sku}-EDIT`, barcode: `QA-BC-${stamp}-EDIT`, nameEn: `Synthetic changed ${stamp}`, nameAr: 'منتج معدل', conversionToBase: '2.3456', costPrice: '13.25', sellPrice: '20.50', reorderLevel: '9', expiryDate: '2031-01-15', descriptionEn: 'Edited English description', descriptionAr: 'وصف معدل' }
    for (const [field, value] of Object.entries(changed)) await edit.locator(`[name="${field}"]`).fill(value)
    await edit.locator('[name="unitType"]').selectOption('KG')
    const updated = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/api/products/${id}`))
    await edit.getByRole('button', { name: 'Update Product', exact: true }).click()
    expect((await updated).status()).toBe(200)
    const edited = databaseProduct(id)
    expect(edited.StockQty).toBe(25.5)
    expect(edited.Sku).toBe(changed.sku)
    expect(edited.NameEn).toBe(changed.nameEn)
    expect(edited.NameAr).toBe(changed.nameAr)
    expect(edited.Barcode).toBe(changed.barcode)
    expect(edited.UnitType).toBe('KG')
    expect(edited.ConversionToBase).toBe(2.3456)
    expect(edited.CostPrice).toBe(13.25)
    expect(edited.SellPrice).toBe(20.5)
    expect(edited.ReorderLevel).toBe(9)
    expect(edited.DescriptionEn).toBe(changed.descriptionEn)
    expect(edited.DescriptionAr).toBe(changed.descriptionAr)
    expect(edited.ExpiryDate).toContain('2031-01-15')
    expect(edited.CategoryId).toBe(categoryId)
    expect(edited.ImageUrl).toBe(saved.imageUrl)

    await page.goto(`${feOrigin(SLUG)}/products/${id}?edit=1`)
    await edit.getByRole('button', { name: 'Remove image' }).click()
    await edit.locator('[name="categoryId"]').selectOption('')
    await edit.locator('[name="expiryDate"]').fill('')
    const cleared = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/api/products/${id}`))
    await edit.getByRole('button', { name: 'Update Product', exact: true }).click()
    expect((await cleared).status()).toBe(200)
    const final = databaseProduct(id)
    expect(final.ImageUrl).toBeNull()
    expect(final.CategoryId).toBeNull()
    expect(final.ExpiryDate).toBeNull()
    expect(final.StockQty).toBe(25.5)
  } finally {
    if (id) await api(`/api/products/${id}`, { method: 'DELETE' })
  }
})
