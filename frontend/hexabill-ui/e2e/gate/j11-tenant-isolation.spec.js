// E2E-G1 / J11: tenant isolation. Tenant A (gulfharvest-test) creates a marker customer. In the SAME browser the user
// switches to tenant B (frozenhub1-test). The marker must not appear in B's customer search, ledger search, command
// palette, browser storage, or page text (0 leaks). The API must refuse a forged tenant header, A's token on B's host,
// and B's invoice / customer ids. A positive control proves the marker is visible to its own tenant first.
// Assistant (mock) is NOT exercised here: the assistant panel has no tenant-scoped mock hook in this build.
import { test, expect } from '@playwright/test'
import { SLUG, OTHER_SLUG, API, EDGE, apiLogin, must, call, signInFor, feOrigin, freshCart } from './gateKit.js'

const hdr = (slug, token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  'X-HexaBill-Original-Host': `${slug}.localhost`,
  'X-HexaBill-Edge-Secret': EDGE,
  ...extra,
})
const status = async (url, headers) => (await fetch(`${API}${url}`, { headers })).status

test('J11 tenant A data never appears in tenant B (search, palette, storage, page) and forged scope is refused', async ({ page }, info) => {
  test.setTimeout(150000)
  const marker = `G1 J11 leak-marker ${Date.now()}`
  const aCustomer = await must(SLUG, '/api/customers', {
    method: 'POST',
    body: { name: marker, phone: `057${String(Date.now()).slice(-7)}`, creditLimit: 0, customerType: 'Credit' },
  })
  const b = await freshCart(OTHER_SLUG, 'j11b')
  const bSale = await must(OTHER_SLUG, '/api/sales', { method: 'POST', body: { customerId: b.customer.id, items: [{ productId: b.products[0].id, unitType: 'PIECE', qty: 1, unitPrice: 20 }], payments: [] } })

  // Positive control: tenant A sees its own marker in its own search.
  await signInFor(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  const aSearch = page.getByPlaceholder("Search customers").filter({ visible: true }).first()
  await aSearch.fill(marker)
  await expect(page.getByText(marker).filter({ visible: true }).first(), 'control: A sees its own customer').toBeVisible({ timeout: 15000 })

  // Switch session in the same browser to tenant B.
  await signInFor(page, OTHER_SLUG)
  await page.goto(`${feOrigin(OTHER_SLUG)}/customers`, { waitUntil: 'networkidle' })
  const bSearch = page.getByPlaceholder("Search customers").filter({ visible: true }).first()
  await bSearch.fill(marker)
  await page.waitForTimeout(800)
  expect(await page.getByText(marker).count(), 'B customer search shows no A data').toBe(0)

  await page.goto(`${feOrigin(OTHER_SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customer' }).fill(marker)
  await page.waitForTimeout(800)
  expect(await page.getByText(marker).count(), 'B ledger search shows no A data').toBe(0)

  // Command palette (Ctrl+K) in B.
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog').filter({ has: page.getByRole('combobox').or(page.getByRole('searchbox')) }).first()
  if (await palette.isVisible().catch(() => false)) await palette.locator('input').first().fill(marker)
  else await page.keyboard.type(marker)
  await page.waitForTimeout(800)
  // The palette echoes the typed query in its "No matches" line; only result rows count as leaks.
  const results = page.getByRole('listbox').getByRole('listitem')
  await expect(page.getByRole('listbox').getByText(/No matches for/)).toBeVisible({ timeout: 10000 })
  expect(await results.filter({ hasNotText: /No matches for/ }).count(), 'B command palette lists no A rows').toBe(0)
  await page.keyboard.press('Escape')

  // Browser storage on B's origin holds no A data.
  const stored = await page.evaluate(() => {
    const dump = []
    for (const store of [window.localStorage, window.sessionStorage]) for (let i = 0; i < store.length; i++) { const k = store.key(i); dump.push(k, store.getItem(k)) }
    return dump.join('\n')
  })
  expect(stored.includes(marker), 'no A data in B storage').toBe(false)
  expect(stored.includes(String(aCustomer.id)) && stored.includes(marker), 'no A customer in B storage').toBe(false)

  await page.screenshot({ path: info.outputPath(`j11-b-${info.project.name}.png`) })

  // API scope: A's token cannot cross tenants, a forged tenant header is refused, B's ids are not readable from A.
  const aTok = (await apiLogin(SLUG)).token
  const bTok = (await apiLogin(OTHER_SLUG)).token
  expect(await status('/api/customers?page=1&pageSize=5', hdr(OTHER_SLUG, aTok)), 'A token on B host').toBe(403)
  expect(await status('/api/customers?page=1&pageSize=5', hdr(SLUG, aTok, { 'X-Tenant-Id': String((await apiLogin(OTHER_SLUG)).user.tenantId) })), 'forged tenant header').toBe(403)
  expect(await status(`/api/sales/${bSale.id}`, hdr(SLUG, aTok)), 'A reads B invoice id').toBe(404)
  expect(await status(`/api/customers/${b.customer.id}`, hdr(SLUG, aTok)), 'A reads B customer id').toBe(404)
  expect(await status(`/api/sales/${bSale.id}`, hdr(OTHER_SLUG, bTok)), 'B reads its own invoice').toBe(200)
})
