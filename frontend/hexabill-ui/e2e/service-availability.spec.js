// P0-02 / P0-07 browser regression. Local dev only. The backend 503 contract itself is covered by
// tests/HexaBill.Tests/tenancy/ServiceUnavailableContractTests.cs; here the browser receives that
// exact contract (route-fulfilled) and must show the right screen, recover, and never resend writes.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const GATE_BODY = { status: 'Unavailable', reason: 'SERVICE_UNAVAILABLE', message: 'HexaBill is starting or being updated. Please try again shortly.', schema: 'InitializationFailed' }
const MAINT_BODY = { success: false, message: 'Planned upgrade until 6pm.', maintenanceMode: true, reason: 'MAINTENANCE_ENABLED', code: 503 }

test('login 503 from the startup gate shows "Server unavailable", then recovers', async ({ page }) => {
  let serverUp = false
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(GATE_BODY) }))
  await page.route('**/api/maintenance-check', (route) => serverUp
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ maintenanceMode: false }) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(GATE_BODY) }))

  await page.goto(`${feOrigin(SLUG)}/login`)
  await page.locator('input[type="email"]').fill('owner@example.test')
  await page.locator('input[autocomplete="current-password"]').fill('not-a-real-password')
  await page.locator('button[type="submit"]').click()

  const overlay = page.locator('[data-service-state]')
  await expect(overlay).toHaveAttribute('data-service-state', 'unavailable')
  await expect(overlay).toContainText('Server unavailable')
  await expect(overlay).not.toContainText(/maintenance/i)

  serverUp = true
  await overlay.getByRole('button', { name: /try again/i }).click()
  await expect(overlay).toBeHidden()
})

test('administrator maintenance shows the maintenance screen with the admin message', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route('**/api/customers**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(MAINT_BODY) }))
  await page.route('**/api/maintenance-check', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ maintenanceMode: true, message: MAINT_BODY.message }) }))
  await page.goto(`${feOrigin(SLUG)}/customers`)
  const overlay = page.locator('[data-service-state]')
  await expect(overlay).toHaveAttribute('data-service-state', 'maintenance')
  await expect(overlay).toContainText('Planned upgrade until 6pm.')
})

test('a failed expense save is sent once, never auto-resent', async ({ page }) => {
  await signIn(page, SLUG)
  let posts = 0
  await page.route('**/api/expenses', (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated failure' }) })
  })
  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  // Send the same request the page sends, through the app's own API client.
  const status = await page.evaluate(async () => {
    const { default: api } = await import('/src/services/api.js')
    try { await api.post('/expenses', { categoryId: 1, amount: 10, date: new Date().toISOString() }) } catch (e) { return e.response?.status ?? -1 }
    return 200
  })
  expect(status).toBe(500)
  await page.waitForTimeout(3000) // longer than the 1s client retry delay
  expect(posts).toBe(1)
})
