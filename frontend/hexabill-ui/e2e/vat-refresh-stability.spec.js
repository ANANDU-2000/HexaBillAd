// VAT-01: scrolling, tab focus and visibility events must not start VAT requests or blank the report.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const isVatGet = (r) => r.request().method() === 'GET' && /\/api\/reports\/vat-return\?/.test(r.url())

test('passive events do not refetch or replace the report', async ({ page }) => {
  await signIn(page, SLUG)
  const requests = []
  page.on('request', (r) => { if (r.method() === 'GET' && /\/api\/reports\/vat-return\?/.test(r.url())) requests.push(Date.now()) })

  const first = page.waitForResponse(isVatGet)
  await page.goto(`${feOrigin(SLUG)}/vat-return`, { waitUntil: 'networkidle' })
  await first
  const loadedCount = requests.length
  expect(loadedCount).toBeGreaterThanOrEqual(1)

  // Mark the DOM so a remount (loading card replacing content) is detectable.
  await page.evaluate(() => { document.body.dataset.vatMarker = '1' })
  const heading = page.getByRole('button', { name: 'Return boxes (draft)' }).filter({ visible: true }).first()
  await expect(heading).toBeVisible()
  const handle = await heading.elementHandle()

  // Scroll, then fire the events a tab switch would fire.
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(80) }
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
  })
  await page.waitForTimeout(1500)

  expect(requests.length, 'no VAT request from scroll/focus/visibility within the dedupe window').toBe(loadedCount)
  expect(await handle.evaluate((el) => el.isConnected), 'report content was not remounted').toBe(true)
  await expect(page.getByText('Loading VAT return...')).toHaveCount(0)
})
