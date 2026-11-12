// UX-A06: unconfirmed-payment banners collapse into ONE neutral alert (<= 64 px with two or more waiting).
// Seeds saved payment intents in sessionStorage in the journal's own format and makes the reconcile lookup
// fail so the banners stay. Recovery logic is not exercised or changed here. Local/dev only.
// Run: npx playwright test e2e/payments-unconfirmed.spec.js --project=d1440 --project=m360
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const KEYS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']

async function seed (page, amounts) {
  await page.evaluate(({ amounts, keys }) => {
    const user = JSON.parse(localStorage.getItem('user'))
    amounts.forEach((amount, i) => {
      const customerId = 7001 + i
      const scope = `hexabill:ledger-payment:v1:${window.location.origin}:${user.tenantId}:${user.id}:${customerId}`
      const intent = {
        version: 1, scope, kind: 'create', idempotencyKey: keys[i],
        request: { customerId, amount, mode: 'CASH' },
        form: JSON.stringify({ kind: 'create', amount, saleId: null, mode: 'CASH', reference: null, date: null, adjustment: false, reason: null }),
      }
      window.sessionStorage.setItem(scope, JSON.stringify(intent))
    })
  }, { amounts, keys: KEYS })
}

async function open (page) {
  await signIn(page, SLUG)
  // The page tries to reconcile saved payments on load; an unreachable server keeps them as banners.
  await page.route((url) => /\/api\/payments\/idempotency\//.test(url.pathname), (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false}' }))
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'domcontentloaded' })
  await seed(page, open.amounts)
  await page.reload({ waitUntil: 'networkidle' })
}

test('two unconfirmed payments show one alert block, <= 64 px, expandable to a retry per payment', async ({ page }, info) => {
  open.amounts = [100, 55.5]
  await open(page)
  const alerts = page.getByRole('alert').filter({ hasText: /unconfirmed/ })
  await expect(alerts).toHaveCount(1)
  await expect(alerts).toContainText('2 payments are unconfirmed')
  const box = await alerts.boundingBox()
  expect(box.height, 'collapsed alert height').toBeLessThanOrEqual(64)
  await expect(page.getByRole('button', { name: 'Retry previous payment' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath(`unconfirmed-collapsed-${info.project.name}.png`) })

  await alerts.getByRole('button', { name: 'Review' }).click()
  await expect(alerts.getByRole('button', { name: 'Retry previous payment' })).toHaveCount(2)
  await expect(alerts).toContainText('#7001')
  await expect(alerts).toContainText('#7002')
  await page.screenshot({ path: info.outputPath(`unconfirmed-expanded-${info.project.name}.png`) })
  await alerts.getByRole('button', { name: 'Hide' }).click()
  await expect(alerts.getByRole('button', { name: 'Retry previous payment' })).toHaveCount(0)
})

test('one unconfirmed payment keeps its full sentence and Retry button', async ({ page }) => {
  open.amounts = [20]
  await open(page)
  const alerts = page.getByRole('alert').filter({ hasText: /unconfirmed/ })
  await expect(alerts).toHaveCount(1)
  await expect(alerts).toContainText('Previous payment of')
  await expect(alerts).toContainText('is unconfirmed')
  await expect(alerts.getByRole('button', { name: 'Retry previous payment' })).toBeVisible()
})
