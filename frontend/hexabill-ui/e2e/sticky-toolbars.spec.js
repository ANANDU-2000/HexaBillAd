// Search/filter bars stay in view while the list scrolls (Payments, Audit log, Stock adjustment history).
// The page is made tall by a test-only spacer, so the check does not depend on how much data the tenant has.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

for (const route of ['/payments', '/audit', '/stock-adjustments']) {
  test(`${route}: the search and filter bar stays pinned while scrolling`, async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
    const bar = page.locator('[data-sticky-toolbar]').filter({ visible: true }).first()
    await expect(bar).toBeVisible()
    // Make the scroll container taller than the viewport, then scroll it all the way down.
    const scroller = await bar.evaluateHandle((el) => {
      const spacer = document.createElement('div')
      spacer.style.height = '4000px'
      spacer.setAttribute('data-test-spacer', '')
      el.parentElement.appendChild(spacer)
      let p = el.parentElement
      while (p && !(p.scrollHeight > p.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement
      return p
    })
    expect(await scroller.evaluate((el) => !!el), 'a scroll container exists').toBe(true)
    const before = (await bar.boundingBox()).y
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(150)
    const after = (await bar.boundingBox()).y
    expect(after).toBeGreaterThanOrEqual(0)
    expect(after).toBeLessThan(before + 120) // pinned near the top of the scroll area, not scrolled away
    await expect(bar).toBeInViewport()
  })
}
