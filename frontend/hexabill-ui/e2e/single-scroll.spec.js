// One scroll model (UX-S03): on the main list pages the document is the only vertical scroller for the content.
// The sidebar nav scrolls by itself (beside the content) and POS keeps its cart list; neither is inside <main> here.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const ROUTES = ['/customers', '/expenses', '/purchases', '/suppliers', '/payments', '/billing-history', '/daily-close']

test('main content has no nested vertical scroller', async ({ page }) => {
  await signIn(page, 'gulfharvest')
  for (const route of ROUTES) {
    await page.goto(`${feOrigin('gulfharvest')}${route}`, { waitUntil: 'networkidle' })
    const nested = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('main *')) {
        const oy = getComputedStyle(el).overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} ${el.clientHeight}/${el.scrollHeight}`)
        }
      }
      return out
    })
    expect(nested, `nested scrollers on ${route}`).toEqual([])
  }
})
