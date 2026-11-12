// E2E-G1 / J4: unconfirmed payment. The server commits the payment, but the response is lost (502 after the POST).
// The reconcile lookup is held down, so the UnconfirmedPaymentsAlert banner must show. Then the lookup is released and
// "Retry previous payment" confirms the result. Server asserts: exactly one payment exists, the balance moved once,
// and the banner clears. Synthetic local tenant only. Runs at d1440 and m360.
import { test, expect } from '@playwright/test'
import { SLUG, API, EDGE, must, signInFor, feOrigin, freshCart, customerBalance, r2, rows } from './gateKit.js'
import { pickValue } from '../pickers.js'

const paymentsFor = async (customerId, amount) =>
  rows(await must(SLUG, '/api/payments?page=1&pageSize=200')).filter((p) => p.customerId === customerId && Math.abs(Number(p.amount) - amount) < 0.001)

test('J4 lost payment answer: banner shows, retry confirms it, no duplicate payment, banner clears', async ({ page }, info) => {
  test.setTimeout(150000)
  const { customer, products } = await freshCart(SLUG, 'j4')
  const sale = await must(SLUG, '/api/sales', { method: 'POST', body: { customerId: customer.id, items: [{ productId: products[0].id, unitType: 'PIECE', qty: 1, unitPrice: 20 }], payments: [] } })
  const before = await customerBalance(SLUG, customer.id)
  const amount = r2(before * 0.25)
  expect(amount).toBeGreaterThan(0)

  await signInFor(page, SLUG)
  // Reconcile lookups fail while holding the test, so the banner stays visible.
  let holdLookup = true
  const lookupMatch = (url) => /\/api\/payments\/idempotency\//.test(url.pathname)
  await page.route(lookupMatch, (route) => (holdLookup
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false}' })
    : route.continue()))

  // The first POST reaches the server (it is committed) and the answer is lost.
  let posts = 0
  await page.route(/\/api\/payments$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    if (posts > 1) return route.continue()
    await route.fetch({
      url: `${API}/api/payments`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })

  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Payment' }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await pickValue(page, dialog.locator('[name="customerId"]'), customer.id)
  await dialog.locator('input[name="amount"]').fill(amount.toFixed(2))
  await dialog.getByRole('button', { name: 'Add Payment', exact: true }).click()

  // Banner: the payment is unconfirmed (its request reached the server, the answer did not come back).
  const alert = page.getByRole('alert').filter({ hasText: /unconfirmed|not received/ }).first()
  await expect(alert, 'unconfirmed payment banner').toBeVisible({ timeout: 20000 })
  expect(posts, 'one POST so far').toBe(1)
  // Server committed the payment exactly once.
  await expect.poll(async () => (await paymentsFor(customer.id, amount)).length, { timeout: 15000 }).toBe(1)

  // Release the lookup and retry: the banner clears and nothing is written twice.
  holdLookup = false
  const bannerCount = () => page.getByRole('alert').filter({ hasText: /unconfirmed|not received|Waiting for confirmation/ }).count()
  const retry = alert.getByRole('button', { name: 'Retry previous payment' })
  // While the banner is still reconciling its button is disabled; wait until it clears itself or the retry is enabled.
  await expect.poll(async () => (await bannerCount()) === 0 || (await retry.isEnabled().catch(() => false)), { timeout: 60000 }).toBe(true)
  if (await bannerCount() > 0) await retry.click()
  await expect.poll(bannerCount, { timeout: 30000 }).toBe(0)

  expect((await paymentsFor(customer.id, amount)).length, 'no duplicate payment after the retry').toBe(1)
  const after = await customerBalance(SLUG, customer.id)
  expect(r2(after), 'balance moved once').toBeCloseTo(r2(before - amount), 2)
  await page.screenshot({ path: info.outputPath(`j4-cleared-${info.project.name}.png`) })
})
