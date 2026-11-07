// UX-A05: owner-facing notification language. Only GET /api/alerts and /api/alerts/unread-count are intercepted.
// Local/dev only. Run: npx playwright test e2e/notifications-language.spec.js --project=d1440 --project=t768 --project=m360
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const ALERTS = [
  { id: 701, type: 'DBMismatch', severity: 'Warning', title: 'Stock mismatch detected for 3 products', message: 'Product IDs: 12, 15, 19', isRead: false, isResolved: false, createdAt: new Date().toISOString() },
  { id: 702, type: 'LowStock', severity: 'Warning', title: 'Low stock: Rice 5kg', message: '3 left, reorder level 10', isRead: false, isResolved: false, createdAt: new Date().toISOString() },
  { id: 703, type: 'OverdueInvoice', severity: 'Error', title: 'Invoice INV-77 is overdue', message: '', isRead: true, isResolved: false, createdAt: new Date().toISOString() },
]

test('mismatch alert is plain language, ids sit behind Details, chips filter, System is Other', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.route((url) => /\/api\/alerts(\/unread-count)?$/.test(url.pathname), (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const body = route.request().url().includes('unread-count') ? 2 : ALERTS
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: body }) })
  })

  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'View alerts and notifications' }).filter({ visible: true }).first().click()
  const panel = page.getByTestId('notifications-panel')
  await expect(panel).toBeVisible()
  // BUG-6: on phones the panel must sit fully on screen, not clipped past an edge.
  const box = await panel.boundingBox()
  const vw = page.viewportSize().width
  expect(box.x, 'panel left edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'panel right edge on screen').toBeLessThanOrEqual(vw)

  // Plain language, no id dump, no raw type name.
  await expect(panel.getByText('Stock needs a recount for 3 products')).toBeVisible()
  await expect(panel.getByText(/Product IDs/)).toHaveCount(0)
  await expect(panel.getByText('DBMismatch')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Review' })).toBeVisible()

  // Details discloses the raw ids (owner here).
  await panel.getByRole('button', { name: 'Details' }).click()
  await expect(panel.getByText('Product IDs: 12, 15, 19')).toBeVisible()
  await page.screenshot({ path: info.outputPath(`notifications-${info.project.name}.png`) })

  // Tabs: "System" is renamed "Other", and chips really filter.
  await expect(panel.getByRole('button', { name: /^System/ })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: /^Other \(1\)/ })).toBeVisible()
  await panel.getByRole('button', { name: /^Stock \(1\)/ }).click()
  await expect(panel.getByText('Low stock: Rice 5kg')).toBeVisible()
  await expect(panel.getByText('Stock needs a recount for 3 products')).toHaveCount(0)
  await expect(panel.getByText('Invoice INV-77 is overdue')).toHaveCount(0)
  await panel.getByRole('button', { name: /^Other \(1\)/ }).click()
  await expect(panel.getByText('Stock needs a recount for 3 products')).toBeVisible()
  await expect(panel.getByText('Low stock: Rice 5kg')).toHaveCount(0)
})
