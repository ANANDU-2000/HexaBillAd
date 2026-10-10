/* eslint-env node */
// Every static tenant route × every viewport project.
// Fails on: redirect to login, page-level sideways scroll, more than one visible top bar,
// uncaught page errors, API 5xx responses.
// Records (does not fail) UX metrics per page into the JSON report named by HEXABILL_SWEEP_REPORT:
// undersized touch targets on phones, visible <h1> count, nested vertical scroll areas.
// Screenshots land in e2e/.shots for review.
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { TENANTS, ownerPassword, signIn, feOrigin } from './session.js'

const ROUTES = [
  '/dashboard', '/pos', '/billing-history', '/sales-ledger', '/ledger', '/payments', '/purchases', '/expenses',
  '/customers', '/products', '/suppliers', '/branches', '/routes', '/pricelist', '/stock-adjustments',
  '/quotations', '/quotations/new', '/delivery-notes', '/returns/create', '/agreements', '/agreements/new',
  '/salary-certificates', '/salary-certificates/new', '/reports', '/reports/outstanding', '/daily-close',
  '/vat-return', '/worksheet', '/users', '/settings', '/audit', '/backup', '/profile', '/help', '/feedback', '/more',
]
const REPORT = process.env.HEXABILL_SWEEP_REPORT

test.skip(!ownerPassword(), 'Set HEXABILL_OWNER_PASSWORD or e2e/.env.local')

// The API allows 300 requests/min per IP. A sweep can exceed that, which would test error
// states instead of the page. On a 429 we wait out the window and reload.
async function loadWithoutRateLimit (page, url, onAttempt) {
  for (let attempt = 0; attempt < 4; attempt++) {
    onAttempt()
    let limited = 0
    const onResponse = (r) => { if (r.status() === 429) limited++ }
    page.on('response', onResponse)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    page.off('response', onResponse)
    if (!limited) return attempt
    await page.waitForTimeout(20_000)
  }
  throw new Error('API rate limit (429) persisted after retries')
}

for (const slug of TENANTS) {
  test.describe(slug, () => {
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }, info) => {
        test.setTimeout(150_000)
        const errors = []
        const serverErrors = []
        page.on('pageerror', (e) => errors.push(e.message))
        const heartbeatErrors = []
        page.on('response', (r) => {
          if (r.status() < 500 || !r.url().includes('/api/')) return
          // The presence heartbeat is a write; on local single-file SQLite it can hit "database is locked"
          // when tests overlap. Recorded in the metrics, not treated as a page failure.
          if (r.url().includes('/api/users/me/ping')) heartbeatErrors.push(r.status())
          else serverErrors.push(`${r.status()} ${r.url()}`)
        })
        await signIn(page, slug)
        // Only the final, rate-limit-free load counts for 5xx checks.
        const retries = await loadWithoutRateLimit(page, `${feOrigin(slug)}${route}`, () => { serverErrors.length = 0 })

        const name = `${slug}${route.replace(/\//g, '_')}-${info.project.name}.png`
        await page.screenshot({ path: `e2e/.shots/${name}` })

        const width = page.viewportSize().width
        const metrics = await page.evaluate((isPhone) => {
          const visible = (el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0
          const small = isPhone
            ? [...document.querySelectorAll('main button, main a[href], main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), main select, main [role=tab]')]
                .filter(visible)
                .filter((el) => el.getBoundingClientRect().height < 40)
                .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30))
            : []
          const h1 = [...document.querySelectorAll('h1')].filter(visible).length
          const nestedScroll = [...document.querySelectorAll('main *')].filter((el) => {
            const cs = getComputedStyle(el)
            return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 120
          }).length
          return { smallTargets: small.length, smallSample: small.slice(0, 6), h1, nestedScroll }
        }, width < 768)
        if (REPORT) {
          fs.appendFileSync(REPORT, JSON.stringify({ slug, route, vp: info.project.name, retries, heartbeat5xx: heartbeatErrors.length, ...metrics }) + '\n')
        }

        await expect(page).not.toHaveURL(/\/login/)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, 'page-level horizontal overflow (px)').toBeLessThanOrEqual(0)
        const bars = await page.locator('header:visible').count()
        expect(bars, 'visible app headers').toBeLessThanOrEqual(1)
        expect(errors, 'uncaught page errors').toEqual([])
        expect(serverErrors, 'API 5xx responses').toEqual([])
      })
    }
  })
}
