// Expenses list states: load failure recovery and the empty period (UX-E07).
// Intercepts only GET /api/expenses (the list); summary, categories and other calls stay real.
// Local/dev only. Run: npx playwright test e2e/expenses-states.spec.js
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = 'gulfharvest'
const isListRequest = (url) => url.pathname.endsWith('/api/expenses')
const visible = (locator) => locator.filter({ visible: true })

test('list failure shows a reason and a Try again action that reloads the list', async ({ page }) => {
  await signIn(page, SLUG)
  let failing = true
  let listCalls = 0
  await page.route(isListRequest, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    listCalls += 1
    if (!failing) return route.continue()
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Server error' }) })
  })

  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  await expect(visible(page.getByText('Expenses could not be loaded. Check your connection, then try again.'))).toHaveCount(1)
  // Recovery is offered on every width, not only desktop.
  const retry = visible(page.getByRole('button', { name: 'Try again' }))
  await expect(retry).toHaveCount(1)

  failing = false
  const before = listCalls
  await retry.click()
  await expect.poll(() => listCalls).toBeGreaterThan(before)
  await expect(visible(page.getByText('Expenses could not be loaded'))).toHaveCount(0)
})

test('empty period shows why and offers Add expense to owners', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.route(isListRequest, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], totalPages: 1, totalCount: 0, page: 1, pageSize: 10 } }),
    })
  })

  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  const message = visible(page.getByText(/No expenses (in this period|for this period)\./))
  await expect(message).toHaveCount(1)
  // Header button plus the in-list empty-state button: both must be reachable.
  await expect(visible(page.getByRole('button', { name: 'Add expense' }))).toHaveCount(2)
  if (info.project.use.viewport.width < 768) {
    await expect(visible(page.getByRole('button', { name: 'Add expense' })).last()).toBeInViewport()
  }
})
