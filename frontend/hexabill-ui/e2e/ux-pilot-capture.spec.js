// Pilot-screen capture: Customers and Payments, per Playwright project (viewport). English only.
// Read-only. Writes full-page + viewport screenshots and a JSON of layout measurements to
// HEXABILL_PILOT_DIR (default e2e/.shots/pilot-<stage>), so before/after can be diffed.
//   HEXABILL_PILOT_STAGE=before|after   HEXABILL_E2E_SLUG=<tenant slug>
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const STAGE = process.env.HEXABILL_PILOT_STAGE || 'before'
const DIR = process.env.HEXABILL_PILOT_DIR || path.join('e2e', '.shots', `pilot-${STAGE}`)
const SCREENS = [
  { id: 'customers', route: '/customers' },
  { id: 'payments', route: '/payments' }
]

async function measure (page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')].filter(vis)
    const small = interactive.filter((el) => { const r = (el.closest('label') || el).getBoundingClientRect(); return Math.min(r.width, r.height) < 32 })
    const rows = [...document.querySelectorAll('tbody tr, [role="row"], [data-testid*="row"], li[class*="border"]')].filter(vis)
    const firstRow = rows[0]?.getBoundingClientRect()
    const above = firstRow ? interactive.filter((el) => el.getBoundingClientRect().bottom <= firstRow.top).length : null
    let minFont = 99
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue
      const f = parseFloat(getComputedStyle(n.parentElement).fontSize)
      if (f < minFont) minFont = f
    }
    const hasTable = !!document.querySelector('table')
    const tbl = document.querySelector('table')
    const wrap = tbl?.parentElement
    const tableInfo = tbl ? {
      tableWidth: Math.round(tbl.getBoundingClientRect().width),
      wrapperWidth: Math.round(wrap.clientWidth),
      wrapperScrollWidth: wrap.scrollWidth,
      sidewaysScrollNeeded: wrap.scrollWidth - wrap.clientWidth > 2,
      headers: [...tbl.querySelectorAll('thead th')].filter(vis).map((h) => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 24)),
      firstRowButtons: [...(tbl.querySelector('tbody tr')?.querySelectorAll('button, a[href]') || [])].filter(vis).map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18), x: Math.round(b.getBoundingClientRect().left), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
    } : null
    return {
      viewport: { vw, vh }, dir: document.documentElement.dir, lang: document.documentElement.lang,
      overflowX: document.documentElement.scrollWidth - vw,
      firstRecordY: firstRow ? Math.round(firstRow.top) : null,
      firstRecordRatio: firstRow ? +(firstRow.top / vh).toFixed(2) : null,
      controlsAboveFirstRecord: above,
      rowHeight: firstRow ? Math.round(firstRow.height) : null,
      rowCountVisible: rows.length,
      controlsUnder32px: small.length,
      smallestTextPx: minFont === 99 ? null : minFont,
      usesTable: hasTable,
      tableInfo,
      scrollContainers: [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && vis(e) }).length,
      textLength: (document.body.innerText || '').trim().length
    }
  })
}

for (const lang of ['en']) {
  test(`pilot ${STAGE} capture (${lang})`, async ({ page }, testInfo) => {
    test.setTimeout(5 * 60_000)
    await page.addInitScript((l) => { try { localStorage.setItem('hexabill_lang', l) } catch { /* ignore */ } }, lang)
    await signIn(page, SLUG)
    fs.mkdirSync(DIR, { recursive: true })
    const out = {}
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
    for (const s of SCREENS) {
      await page.goto(`${feOrigin(SLUG)}${s.route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      await page.waitForTimeout(600)
      const base = path.join(DIR, `${s.id}-${lang}-${testInfo.project.name}`)
      await page.screenshot({ path: `${base}.png` })
      await page.screenshot({ path: `${base}-full.png`, fullPage: true })
      out[s.id] = await measure(page)
    }
    fs.writeFileSync(path.join(DIR, `metrics-${lang}-${testInfo.project.name}.json`), JSON.stringify({ stage: STAGE, lang, project: testInfo.project.name, errors, screens: out }, null, 1))
    expect(errors).toEqual([])
  })
}
