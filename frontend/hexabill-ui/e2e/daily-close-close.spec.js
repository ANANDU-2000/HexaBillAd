// Daily close: close a past business day and reopen it. The test uses yesterday (2026-10-10) so the
// other specs, which post today's payments, are not blocked. Opening cash is set to the amount that
// makes expected drawer cash zero, the count is zero, so no variance reason is needed. The day is
// reopened at the end, so the local data is left as it was. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const DAY = '2026-10-10'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const isClosed = async () => {
  const { json } = await api(`/api/daily-close/status?businessDate=${DAY}`)
  // A reopened day keeps its record (status Reopened) and is not locked; isLocked is the closed state.
  return Boolean(json.data?.isLocked)
}

test('daily close: close a past day with no variance, then reopen it', async ({ page }) => {
  await signIn(page, SLUG)
  // Start from an open day.
  if (await isClosed()) {
    const r = await api('/api/daily-close/reopen', { method: 'POST', body: JSON.stringify({ businessDate: DAY, reason: 'Test setup: reopen before run' }) })
    expect(r.status).toBeLessThan(300)
  }
  // Expected cash with no opening cash, from the server.
  const preview = (await api(`/api/daily-close/preview?businessDate=${DAY}&openingCash=0`)).json.data
  const opening = Math.max(0, -Number(preview.expectedCash))

  await page.goto(`${feOrigin(SLUG)}/daily-close`, { waitUntil: 'networkidle' })
  await page.locator('input[type="date"]').first().fill(DAY)
  await page.locator('label', { hasText: /^Opening cash/ }).locator('input').fill(opening.toFixed(2))
  await expect(page.getByText('Expected in drawer').filter({ visible: true }).first()).toBeVisible()
  // The expected figure now includes the opening cash. Count exactly that amount (zero, when it is zero).
  await expect.poll(async () => {
    const txt = await page.getByText('Expected in drawer').first().locator('xpath=..').innerText()
    const nums = txt.match(/-?[\d,]+\.\d{2}/g) || []
    return nums.length ? Number(nums[nums.length - 1].replace(/,/g, '')) : null
  }).toBeCloseTo(0, 2)
  await page.locator('label', { hasText: /^Counted cash/ }).locator('input').fill('0')

  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/daily-close$/.test(r.url()))
  await page.getByRole('button', { name: 'Submit close' }).click()
  const savedRes = await saved
  if (savedRes.status() >= 300) throw new Error(`POST /api/daily-close ${savedRes.status()}: ${await savedRes.text()}`)

  // The server confirms the close (not just a toast).
  await expect.poll(isClosed).toBe(true)
  await expect(page.getByText(/This business day is closed/).filter({ visible: true }).first()).toBeVisible()

  // Reopen with a reason; the server confirms the day is open again.
  await page.locator('input[placeholder="Reopen reason (required)"]').filter({ visible: true }).first().fill('Test cleanup: reopen after close check')
  const reopened = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/daily-close\/reopen$/.test(r.url()))
  await page.getByRole('button', { name: 'Reopen day' }).filter({ visible: true }).first().click()
  const reopenRes = await reopened
  if (reopenRes.status() >= 300) throw new Error(`POST /api/daily-close/reopen ${reopenRes.status()}: ${await reopenRes.text()}`)
  await expect.poll(isClosed).toBe(false)
})

test('daily close: a close with a variance and no reason is refused, and the day stays open', async ({ page }) => {
  await signIn(page, SLUG)
  if (await isClosed()) {
    const r = await api('/api/daily-close/reopen', { method: 'POST', body: JSON.stringify({ businessDate: DAY, reason: 'Test setup: reopen before run' }) })
    expect(r.status).toBeLessThan(300)
  }
  const preview = (await api(`/api/daily-close/preview?businessDate=${DAY}&openingCash=0`)).json.data
  const opening = Math.max(0, -Number(preview.expectedCash))

  await page.goto(`${feOrigin(SLUG)}/daily-close`, { waitUntil: 'networkidle' })
  await page.locator('input[type="date"]').first().fill(DAY)
  await page.locator('label', { hasText: /^Opening cash/ }).locator('input').fill(opening.toFixed(2))
  // Count 5.00 more than expected: a variance that needs a reason.
  await page.locator('label', { hasText: /^Counted cash/ }).locator('input').fill('5')
  await expect(page.getByText(/Variance: .*reason required to close/).filter({ visible: true }).first()).toBeVisible()

  const attempt = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/daily-close$/.test(r.url()))
  await page.getByRole('button', { name: 'Submit close' }).click()
  const res = await attempt
  expect(res.status()).toBeGreaterThanOrEqual(400)
  // The refusal is shown to the user, and the server did not close the day.
  await expect(page.getByText(/reason|variance/i).filter({ visible: true }).first()).toBeVisible()
  expect(await isClosed()).toBe(false)
})
