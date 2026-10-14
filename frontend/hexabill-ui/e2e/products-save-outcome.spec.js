// Focused browser failure contract with synthetic route fixtures. This is not API/DB persistence coverage.
import { test, expect } from '@playwright/test'

test.use({ trace: 'off' })

for (const lookupFails of [false, true]) {
  test(`uncertain product create retains form when reconciliation ${lookupFails ? 'fails' : 'finds a pre-existing SKU'}`, async ({ page }) => {
    let posts = 0
    const existing = { id: 41, sku: 'QA-EXISTING', nameEn: 'Existing synthetic item', unitType: 'PCS', conversionToBase: 1, costPrice: 5, sellPrice: 9, stockQty: 10, isActive: true }
    await page.addInitScript(() => {
      localStorage.setItem('token', 'synthetic-browser-fixture')
      localStorage.setItem('user', JSON.stringify({ id: 1, tenantId: 1, role: 'Owner', name: 'Synthetic owner', companyName: 'QA', mustChangePassword: false }))
    })
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/products' && route.request().method() === 'POST') {
        posts++
        return route.fulfill({ status: 502, contentType: 'text/html', body: 'Synthetic gateway failure' })
      }
      if (url.pathname === '/api/products' && lookupFails && posts > 0 && url.searchParams.get('search') === existing.sku) {
        return route.fulfill({ status: 500, json: { success: false, message: 'Synthetic reconciliation failure' } })
      }
      const data = url.pathname === '/api/auth/validate'
        ? { userId: 1, tenantId: 1, role: 'Owner', name: 'Synthetic owner' }
        : url.pathname === '/api/products'
          ? { items: [existing], totalPages: 1, totalCount: 1 }
          : []
      return route.fulfill({ json: { success: true, data, maintenanceMode: false } })
    })
    await page.goto('http://gulfharvest.localhost:5173/products')
    await page.getByRole('button', { name: 'Add product', exact: true }).filter({ visible: true }).first().click()
    const form = page.locator('form').filter({ has: page.locator('input[name="nameEn"]') })
    await form.locator('[name="sku"]').fill(existing.sku)
    await form.locator('[name="nameEn"]').fill('New synthetic item')
    await form.locator('[name="costPrice"]').fill('5')
    await form.locator('[name="sellPrice"]').fill('9')
    await form.getByRole('button', { name: 'Create Product', exact: true }).click()
    await expect(page.getByText(/Save status is uncertain/i)).toBeVisible()
    await expect(form).toBeVisible()
    await expect(form.locator('[name="nameEn"]')).toHaveValue('New synthetic item')
    await expect(page.getByText(/Product created|nothing was saved/i)).toHaveCount(0)
    expect(posts).toBe(1)
  })
}

test('page selection and typed bulk deactivation retain only failed selections', async ({ page }) => {
  const products = [1, 2].map(id => ({ id, sku: `QA-BULK-${id}`, nameEn: `Synthetic bulk ${id}`, unitType: 'PCS', stockQty: 10, sellPrice: 9, isActive: true }))
  const deletes = []
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-browser-fixture')
    localStorage.setItem('user', JSON.stringify({ id: 1, tenantId: 1, role: 'Owner', name: 'Synthetic owner', mustChangePassword: false }))
  })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'DELETE') {
      deletes.push(url.pathname)
      if (url.pathname.endsWith('/2')) return route.fulfill({ status: 500, json: { success: false, message: 'Synthetic partial failure' } })
      products[0].isActive = false
      return route.fulfill({ json: { success: true, data: {} } })
    }
    const data = url.pathname === '/api/auth/validate'
      ? { userId: 1, tenantId: 1, role: 'Owner', name: 'Synthetic owner' }
      : url.pathname === '/api/products' ? { items: products.filter(p => p.isActive), totalPages: 1, totalCount: 2 } : []
    return route.fulfill({ json: { success: true, data, maintenanceMode: false } })
  })
  await page.goto('http://gulfharvest.localhost:5173/products')
  await page.getByRole('checkbox', { name: 'Select all products on this page', exact: true }).filter({ visible: true }).check()
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('2 selected products')
  const confirm = dialog.getByRole('button', { name: 'Deactivate 2', exact: true })
  await expect(confirm).toBeDisabled()
  expect(deletes).toHaveLength(0)
  await dialog.locator('input').fill('DEACTIVATE')
  await confirm.click()
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Select Synthetic bulk 2', exact: true }).filter({ visible: true })).toBeChecked()
  expect(deletes).toEqual(['/api/products/1', '/api/products/2'])
})
