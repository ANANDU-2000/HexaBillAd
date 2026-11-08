// P-01 request control: last response wins on fast filter changes, and slow loads show "Still loading... Cancel".
// Mocks only GET /api/reports/sales-ledger. Run: npx playwright test e2e/request-control.spec.js
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const isLedger = (url) => url.pathname.endsWith('/api/reports/sales-ledger')
const visible = (locator) => locator.filter({ visible: true })

const entry = (type, customerName) => ({
  date: new Date().toISOString(), type, invoiceNo: `INV-${customerName}`, customerId: 1, customerName,
  paymentMode: 'Cash', grandTotal: 10, paidAmount: 10, realPending: 0, realGotPayment: 10, status: 'Paid',
  customerBalance: 0, saleId: 1, paymentId: type === 'Payment' ? 1 : null,
})
const body = (type, name) => JSON.stringify({ success: true, data: { entries: [entry(type, name)], summary: {} } })

// Move the page to a new URL the way Back/Forward does, without a reload.
const goToQuery = (page, query) => page.evaluate((q) => {
  window.history.pushState({}, '', `${window.location.pathname}${q}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}, query)

test('fast filter changes show only the last result', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route((url) => isLedger(url), async (route) => {
    const type = new URL(route.request().url()).searchParams.get('entryType')
    const delay = type === 'Sale' ? 1800 : 50
    await new Promise((r) => setTimeout(r, delay))
    const payload = type === 'Sale' ? body('Sale', 'SLOWSALE') : type === 'Payment' ? body('Payment', 'FASTPAY') : body('Sale', 'INITIAL')
    try { await route.fulfill({ status: 200, contentType: 'application/json', body: payload }) } catch { /* aborted by the page */ }
  })

  await page.goto(`${feOrigin(SLUG)}/sales-ledger`, { waitUntil: 'networkidle' })
  await goToQuery(page, '?type=Sale')
  await page.waitForTimeout(150)
  await goToQuery(page, '?type=Payment')

  await expect(visible(page.getByText('FASTPAY')).first()).toBeVisible()
  await page.waitForTimeout(2500) // long enough for the slow Sale response to have arrived if it were applied
  await expect(visible(page.getByText('FASTPAY')).first()).toBeVisible()
  await expect(visible(page.getByText('SLOWSALE'))).toHaveCount(0)
})

test('a slow ledger shows Still loading with Cancel, then Retry', async ({ page }) => {
  await signIn(page, SLUG)
  let slow = false
  await page.route((url) => isLedger(url), async (route) => {
    if (slow) await new Promise((r) => setTimeout(r, 6000))
    try { await route.fulfill({ status: 200, contentType: 'application/json', body: body('Sale', 'RECOVERED') }) } catch { /* aborted */ }
  })
  await page.goto(`${feOrigin(SLUG)}/sales-ledger`, { waitUntil: 'networkidle' })

  slow = true
  await goToQuery(page, '?type=Sale')
  const notice = page.getByTestId('load-status-notice')
  await expect(notice).toHaveCount(0) // nothing before 3 s
  await expect(notice).toContainText('Still loading', { timeout: 5000 })
  await visible(page.getByRole('button', { name: 'Cancel' })).click()
  await expect(notice).toContainText('Loading cancelled')

  slow = false
  await visible(notice.getByRole('button', { name: 'Retry' })).click()
  await expect(visible(page.getByText('RECOVERED')).first()).toBeVisible()
  await expect(notice).toHaveCount(0)
})
