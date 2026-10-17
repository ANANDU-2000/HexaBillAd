// UX-05: the owner dashboard shows today's Daily Close status that agrees with the server,
// and the button reaches the existing Daily close page. Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

test('dashboard daily close card matches the server and opens Daily close', async ({ page }) => {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}/api/daily-close/status?businessDate=${localToday()}`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  expect(r.status).toBe(200)
  const body = await r.json()
  const current = body.data?.current ?? body.data?.Current ?? null
  const status = String(current?.status ?? '').toLowerCase()

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const card = page.getByRole('region', { name: 'Daily close status' })
  await expect(card).toBeVisible()
  if (!current) await expect(card).toContainText('Not closed yet')
  else if (status === 'closed') await expect(card).toContainText('Closed')
  else await expect(card).not.toContainText('Daily close: Closed')

  const vp = page.viewportSize()
  const button = card.getByRole('button')
  const box = await button.boundingBox()
  if (vp.width < 1024) expect(box.height).toBeGreaterThanOrEqual(43) // desktop-width buttons are compacted by the design system (see UX-03)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

  await button.click()
  await expect(page).toHaveURL(/\/daily-close/)
})
