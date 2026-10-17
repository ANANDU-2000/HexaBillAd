// REL-03: moving between pages and switching tabs must not re-request tenant branding each time.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('branding logo is requested once across in-app navigation and tab visibility changes', async ({ page }) => {
  await signIn(page, SLUG)
  let logoRequests = 0
  page.on('request', (r) => { if (r.method() === 'GET' && /\/api\/settings\/logo-data-uri/.test(r.url())) logoRequests++ })

  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const afterFirstLoad = logoRequests
  expect(afterFirstLoad).toBeGreaterThanOrEqual(1)

  for (const path of ['/purchases', '/products', '/customers']) {
    await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
    await page.waitForLoadState('networkidle')
  }
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(1000)

  expect(logoRequests, 'no extra logo request from navigation or visibility').toBe(afterFirstLoad)
})
