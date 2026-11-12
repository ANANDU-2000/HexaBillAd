// Motion system: route bar + page transition + staggered KPIs run normally, and are fully off for "reduce motion".
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const names = (page) => page.evaluate(() => [...new Set(document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName).filter(Boolean))])

test('motion runs by default', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  // client-side navigation when the link is reachable (collapsed sidebar groups fall back to a fresh load: same animations)
  await page.getByRole('link', { name: 'Reports', exact: true }).first().click({ timeout: 4000 }).catch(() => page.goto(`${feOrigin(SLUG)}/reports?tab=summary`, { waitUntil: 'commit' }))
  const seen = await names(page)
  expect(seen).toContain('hb-route-bar')
  expect(seen).toContain('hb-page-in')
  await expect(page.getByText('Total sales', { exact: true })).toBeVisible()
  // every one-shot animation settles (loops like the skeleton shimmer are excluded)
  await expect.poll(async () => (await names(page)).filter((n) => n.startsWith('hb-') && n !== 'hb-shimmer'), { timeout: 6000 }).toEqual([])
  expect(await page.locator('.hb-stagger').count()).toBeGreaterThan(0)
})

test('reduced motion turns every hb-* animation off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/reports?tab=summary`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(100)
  expect((await names(page)).filter((n) => n.startsWith('hb-'))).toEqual([])
  await expect(page.getByText('Total sales', { exact: true })).toBeVisible()
})
