import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { signIn, feOrigin } from './session.js'

/**
 * Page inventory sweep: every tenant route at phone / tablet / desktop.
 * Writes screenshots + docs/ui-inventory.json so each loop iteration can diff against the last.
 * Run: npx playwright test e2e/ui-inventory.spec.js --project=m390
 * Env: UI_INV_VIEWPORT=m390|t768|d1440  UI_INV_LIMIT=n
 */
const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const OUT = process.env.UI_INV_OUT || 'C:/Users/anand/AppData/Local/Temp/opencode/ui-inventory'

const ROUTES = [
  '/dashboard', '/pos', '/ledger', '/sales-ledger', '/billing-history', '/pending-bills',
  '/payments', '/expenses', '/purchases', '/suppliers', '/customers', '/products', '/pricelist',
  '/quotations', '/quotations/new', '/agreements', '/agreements/new', '/delivery-notes',
  '/returns/create', '/stock-adjustments', '/reports', '/reports/outstanding', '/profit-history',
  '/daily-close', '/vat-return', '/worksheet', '/documents', '/route-map', '/my-routes',
  '/branches', '/routes', '/users', '/audit', '/backup', '/settings', '/profile', '/more',
  '/assistant', '/help', '/feedback', '/legacy/invoices', '/salary-certificates',
]

const LIMIT = Number(process.env.UI_INV_LIMIT || ROUTES.length)

test.describe.configure({ mode: 'serial' })
test.setTimeout(60 * 60 * 1000)

test('ui inventory', async ({ page }, info) => {
  const vp = info.project.name
  mkdirSync(`${OUT}/${vp}`, { recursive: true })
  await signIn(page, SLUG)
  const rows = []
  for (const route of ROUTES.slice(0, LIMIT)) {
    const failed = []
    const onResp = (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]}`) }
    page.on('response', onResp)
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1800)
    const name = route.replace(/\//g, '_').slice(1)
    await page.screenshot({ path: `${OUT}/${vp}/${name}.png`, fullPage: true }).catch(() => {})

    const m = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const vis = (el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
      }
      const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 48)
      const controls = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="tab"]')].filter(vis)
      const small = controls.map((el) => {
        const r = el.getBoundingClientRect()
        const lab = el.closest('label')
        const inBigLabel = !!lab && lab.getBoundingClientRect().height >= 44
        return { l: label(el), w: Math.round(r.width), h: Math.round(r.height), inBigLabel }
      }).filter((c) => (c.w < 44 || c.h < 44) && !c.inBigLabel)

      const tiny = [...document.querySelectorAll('p,span,div,label,td,th,li,small')].filter(vis)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12 && (el.textContent || '').trim())

      const bars = [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el)
        if (!['fixed', 'sticky'].includes(s.position)) return false
        // The bottom navigation and toast host are expected overlays, not page defects.
        if (el.closest('nav[aria-label="Main navigation"]') || el.closest('.hb-toaster')) return false
        const r = el.getBoundingClientRect()
        return r.height > 24 && r.width > vw * 0.6 && r.top > vh * 0.35 && r.bottom > vh - 20
      }).map((el) => {
        const r = el.getBoundingClientRect()
        return { cls: String(el.className).slice(0, 60), h: Math.round(r.height), top: Math.round(r.top) }
      })

      const loader = document.querySelector('.animate-spin, [role="status"], [aria-busy="true"]')
      const errorCard = /could not be loaded|failed to load|went wrong/i.test(document.body.innerText)
      const empty = /no .* (yet|found)|nothing (here|to show)|empty/i.test(document.body.innerText)
      return {
        vw, vh,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > vw + 1,
        height: Math.round(document.body.scrollHeight),
        smallCount: small.length, small: small.slice(0, 6),
        tinyCount: tiny.length,
        bars,
        loader: !!loader,
        errorCard, empty,
        title: (document.querySelector('h1')?.innerText || document.title || '').trim().slice(0, 60),
      }
    })
    page.off('response', onResp)
    rows.push({ route, ...m, failed: [...new Set(failed)] })
    console.log(`${vp} ${route}: h=${m.height} small=${m.smallCount} tiny=${m.tinyCount} overflow=${m.overflow} err=${m.errorCard} loader=${m.loader} fail=${[...new Set(failed)].join(',') || '-'}`)
  }
  writeFileSync(`${OUT}/${vp}.json`, JSON.stringify(rows, null, 2))
})
