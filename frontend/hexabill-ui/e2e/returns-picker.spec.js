// UX-A04: /returns/create with no invoice lets you pick one in at most 2 taps.
// Only GET /api/sales (the list) is intercepted. Local/dev only.
// Run: npx playwright test e2e/returns-picker.spec.js --project=d1440 --project=m360
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const SALES = [
  { id: 9301, invoiceNo: 'INV-9301', invoiceDate: '2026-11-06T10:00:00', customerName: 'Picker Trading', grandTotal: 105 },
  { id: 9302, invoiceNo: 'INV-9302', invoiceDate: '2026-11-05T10:00:00', customerName: 'Picker Two', grandTotal: 210 },
  { id: 9303, invoiceNo: 'INV-OLD', invoiceDate: '2026-01-05T10:00:00', customerName: 'Old Customer', grandTotal: 50, isLegacy: true },
]

test('no invoice in the URL: search, tap an invoice, the return flow opens', async ({ page }, info) => {
  await signIn(page, SLUG)
  const queries = []
  await page.route((url) => url.pathname.endsWith('/api/sales'), (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const u = new URL(route.request().url())
    queries.push(Object.fromEntries(u.searchParams))
    const term = (u.searchParams.get('search') || '').toLowerCase()
    const items = SALES.filter((s) => !term || s.invoiceNo.toLowerCase().includes(term) || s.customerName.toLowerCase().includes(term))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items, totalCount: items.length, totalPages: 1, page: 1, pageSize: 20 } }) })
  })

  await page.goto(`${feOrigin(SLUG)}/returns/create`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'New return' })).toBeVisible()
  // Tap 0: the recent list is already there (last 30 days), legacy invoice is not offered.
  await expect(page.getByRole('button', { name: 'Return from INV-9301' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Return from INV-9302' })).toBeVisible()
  await expect(page.getByText('INV-OLD')).toHaveCount(0)
  expect(queries[0].fromDate).toBeTruthy()
  expect(queries[0].search).toBeUndefined()
  await page.screenshot({ path: info.outputPath(`returns-picker-${info.project.name}.png`) })

  // Search narrows by number or customer and drops the date limit.
  await page.getByPlaceholder('Invoice number or customer').fill('Picker Two')
  await expect(page.getByRole('button', { name: 'Return from INV-9301' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Return from INV-9302' })).toBeVisible()
  expect(queries.at(-1).search).toBe('Picker Two')
  expect(queries.at(-1).fromDate).toBeUndefined()

  // One tap on an invoice opens the existing return flow for it.
  await page.getByRole('button', { name: 'Return from INV-9302' }).click()
  await expect(page).toHaveURL(/\/returns\/create\?saleId=9302/)
})

test('a failed list shows a reason and Try again, an empty search says so', async ({ page }) => {
  await signIn(page, SLUG)
  let failing = true
  await page.route((url) => url.pathname.endsWith('/api/sales'), (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    if (failing) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Server error' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], totalCount: 0, totalPages: 1 } }) })
  })
  await page.goto(`${feOrigin(SLUG)}/returns/create`, { waitUntil: 'networkidle' })
  await expect(page.locator('[aria-busy]').getByText('Server error')).toBeVisible()
  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(/No invoices in the last 30 days/)).toBeVisible()
})
