// UX-06: a failed Sales Ledger load is an error with Try again, never "No transactions found".
// Only the ledger response is mocked to fail, then the real API answers.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('sales ledger: a failed load shows an error with retry, then recovers from the real API', async ({ page }) => {
  await signIn(page, SLUG)
  let failing = true
  await page.route(/\/api\/reports\/sales-ledger/, (route) => failing
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
    : route.continue())
  await page.goto(`${feOrigin(SLUG)}/sales-ledger`, { waitUntil: 'networkidle' })

  const alert = page.getByRole('alert').filter({ hasText: 'The sales ledger could not be loaded' }).filter({ visible: true })
  await expect(alert).toBeVisible()
  await expect(page.getByText(/No transactions found/)).toHaveCount(0)

  failing = false
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'The sales ledger could not be loaded' })).toHaveCount(0)
})
