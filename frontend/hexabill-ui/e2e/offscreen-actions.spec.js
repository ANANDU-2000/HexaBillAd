// No action is hidden past the screen edge (UX-C05 class): on each main page, no visible button or link inside <main>
// extends beyond the viewport on the right. A scrolling strip of tabs or chips (a scroll container with no table in it)
// is not counted: it scrolls by design. Controls inside a wide table are counted: that was the bug.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const ROUTES = ['/customers', '/products', '/suppliers', '/purchases', '/expenses', '/payments', '/billing-history', '/users', '/daily-close', '/reports', '/vat-return', '/ledger', '/sales-ledger', '/settings']

test('no button or link is cut off at the right edge', async ({ page }) => {
  await signIn(page, 'gulfharvest')
  const found = []
  for (const route of ROUTES) {
    await page.goto(`${feOrigin('gulfharvest')}${route}`, { waitUntil: 'networkidle' })
    const cut = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const out = []
      for (const el of document.querySelectorAll('main button, main a[href], main [role="menuitem"]')) {
        if (el.closest('[role="tablist"]')) continue
        let strip = el.parentElement
        while (strip && strip !== document.body) {
          const ox = getComputedStyle(strip).overflowX
          if ((ox === 'auto' || ox === 'scroll') && strip.scrollWidth > strip.clientWidth) break
          strip = strip.parentElement
        }
        if (strip && strip !== document.body && !strip.querySelector('table')) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const st = getComputedStyle(el)
        if (st.visibility === 'hidden' || st.display === 'none') continue
        if (r.right > vw + 1) out.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)} @${Math.round(r.left)}-${Math.round(r.right)}`)
      }
      return out
    })
    if (cut.length) found.push(`${route}: ${cut.slice(0, 4).join(' | ')} (${cut.length})`)
  }
  expect(found, 'controls past the right edge').toEqual([])
})
