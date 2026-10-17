// REL-02 (S082/S223): the staff Activity dialog, from the desktop button and the phone button, calls the admin route and
// shows a failed load as an error, never as "No activity recorded". Recent sessions follows the same rule.
// Only the activity and sessions responses are mocked. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

const activityButton = (page) => page.getByRole('button', { name: /activity/i }).filter({ visible: true }).first()

test('activity: calls the admin route, failure is an error, success lists rows', async ({ page }) => {
  await signIn(page, SLUG)
  const urls = []
  let failing = true
  await page.route(/\/api\/admin\/users\/\d+\/activity/, (route) => {
    urls.push(new URL(route.request().url()).pathname)
    return failing
      ? route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Resource not found' }) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 1, action: 'Login', details: 'UX audit sign-in', createdAt: '2026-10-17T08:00:00Z' }] }) })
  })
  await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })

  await activityButton(page).click()
  await expect(page.getByRole('alert').filter({ hasText: /Resource not found/ })).toBeVisible()
  await expect(page.getByText('No activity recorded for this user.')).toHaveCount(0)
  expect(urls.length).toBeGreaterThan(0)
  expect(urls.every((u) => /^\/api\/admin\/users\/\d+\/activity$/.test(u))).toBe(true)

  // Close, then succeed.
  await page.keyboard.press('Escape')
  failing = false
  await activityButton(page).click()
  await expect(page.getByText('UX audit sign-in')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: /Resource not found/ })).toHaveCount(0)
})

test('recent sessions: failure is an error, not "No sessions found"', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route(/\/api\/admin\/sessions|\/api\/users\/sessions|\/sessions(\?.*)?$/, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }))
  await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })
  const sessionsButton = page.getByRole('button', { name: /sessions/i }).filter({ visible: true }).first()
  if (!(await sessionsButton.count())) test.skip(true, 'Recent sessions button is not shown at this width')
  await sessionsButton.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Sessions could not be loaded' })).toBeVisible()
  await expect(page.getByText('No sessions found.')).toHaveCount(0)
})
