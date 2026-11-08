// UX-B06: 700-1023 px portrait tablet gets the tablet shell (icon rail, no bottom nav), not the phone shell.
// Run with -Projects t768 (752x1254 portrait tablet) and m360 (phone must be unchanged).
import { test, expect } from '@playwright/test'
import { SLUG, feOrigin } from './gate/gateKit.js'
import { signIn } from './session.js'

test('tablet portrait 752 px: icon rail visible, bottom nav hidden, phone header hidden', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width < 700 || viewport.width > 1023, 'tablet-only check')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const shell = await page.evaluate(() => {
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none'
    const bottomNav = document.querySelector('.safe-area-bottom')
    const rail = document.querySelector('.no-print')
    const phoneHeader = document.querySelector('header[class*="tab:hidden"]')
    return { bottomNav: shown(bottomNav), rail: shown(rail), phoneHeader: shown(phoneHeader) }
  })
  expect(shell.bottomNav, 'bottom nav is hidden on tablet portrait').toBe(false)
  expect(shell.rail, 'icon rail is visible on tablet portrait').toBe(true)
  expect(shell.phoneHeader, 'phone header is hidden on tablet portrait').toBe(false)
})

test('phone 360 px keeps the bottom nav', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width >= 700, 'phone-only check')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const bottomNavShown = await page.evaluate(() => {
    const el = document.querySelector('.safe-area-bottom')
    return !!el && getComputedStyle(el).display !== 'none'
  })
  expect(bottomNavShown, 'bottom nav is shown on phone').toBe(true)
})
