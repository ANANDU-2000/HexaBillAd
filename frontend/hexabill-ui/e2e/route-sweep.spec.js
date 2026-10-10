// Every static tenant route × every viewport project: no page-level sideways scroll,
// one visible top bar, no uncaught errors. Screenshots land in e2e/.shots for review.
import { test, expect } from '@playwright/test'
import { TENANTS, ownerPassword, signIn, feOrigin } from './session.js'

const ROUTES = [
  '/dashboard', '/pos', '/billing-history', '/sales-ledger', '/ledger', '/payments', '/purchases', '/expenses',
  '/customers', '/products', '/suppliers', '/branches', '/routes', '/pricelist', '/stock-adjustments',
  '/quotations', '/quotations/new', '/delivery-notes', '/returns/create', '/agreements', '/agreements/new',
  '/salary-certificates', '/salary-certificates/new', '/reports', '/reports/outstanding', '/daily-close',
  '/vat-return', '/worksheet', '/users', '/settings', '/audit', '/backup', '/profile', '/help', '/feedback', '/more',
]

test.skip(!ownerPassword(), 'Set HEXABILL_OWNER_PASSWORD or e2e/.env.local')

for (const slug of TENANTS) {
  test.describe(slug, () => {
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }, info) => {
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        await signIn(page, slug)
        await page.goto(`${feOrigin(slug)}${route}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(400)

        const name = `${slug}${route.replace(/\//g, '_')}-${info.project.name}.png`
        await page.screenshot({ path: `e2e/.shots/${name}` })

        await expect(page).not.toHaveURL(/\/login/)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, 'page-level horizontal overflow (px)').toBeLessThanOrEqual(0)
        const bars = await page.locator('header:visible').count()
        expect(bars, 'visible app headers').toBeLessThanOrEqual(1)
        expect(errors, 'uncaught page errors').toEqual([])
      })
    }
  })
}
