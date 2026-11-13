// The fixed sidebar must never sit on top of the page: the main column and the top bar start
// exactly where the rail ends. Regression guard for the 28px overlap (rail w-24 vs content pl-16).
// Desktop only (the fixed sidebar starts at 1280px). Read-only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('content clears the sidebar at desktop widths', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 1280, 'the fixed sidebar starts at xl (1280)')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })

  const aside = page.locator('div.no-print.fixed.inset-y-0').first()
  const main = page.locator('#main-content')
  const topBar = page.locator('header.fixed:visible').last()

  const rail = await aside.boundingBox()
  const content = await main.boundingBox()
  const bar = await topBar.boundingBox()
  expect(rail, 'sidebar is on screen').toBeTruthy()
  expect(content, 'main column is on screen').toBeTruthy()
  expect(bar, 'top bar is on screen').toBeTruthy()

  const railRight = rail.x + rail.width
  expect(content.x, 'main starts at the sidebar edge').toBeGreaterThanOrEqual(railRight - 1)
  expect(bar.x, 'top bar starts at the sidebar edge').toBeGreaterThanOrEqual(railRight - 1)
})
