/* global process */
// UX Phase 1 audit: measures (does not change) the four priority list pages plus
// POS and the add-expense form. Local/dev tenants only.
// Run: npx playwright test e2e/ux-audit.spec.js --project=m360 --project=m390 --project=t768 --project=d1440
// Output: e2e/.shots/ux-audit/<vp>.jsonl and e2e/.shots/audit-<route>-<vp>.png (both gitignored).
import { test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_AUDIT_TENANT || 'gulfharvest'
const ROUTES = ['/customers', '/billing-history', '/expenses', '/ledger', '/pos', '/purchases', '/suppliers', '/daily-close', '/payments']
const here = path.dirname(fileURLToPath(import.meta.url))
// Not under .results: Playwright empties its outputDir on every run.
const outDir = path.join(here, '.shots', 'ux-audit')
const shotDir = path.join(here, '.shots')

function record (vp, row) {
  fs.mkdirSync(outDir, { recursive: true })
  fs.appendFileSync(path.join(outDir, `${vp}.jsonl`), JSON.stringify(row) + '\n')
}

// Pages whose record lists are not divided lists/table bodies.
const ROW_LISTS = 'main tbody, main ul.divide-y, main div.divide-y, main div.md\\:hidden.space-y-3, main div.xl\\:hidden.space-y-3, main div.p-1.space-y-0\\.5'

// Runs in the page. Returns layout facts for the visible list.
function measure (ROW_LISTS) {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < vh * 4
  }
  // Candidate record rows: table body rows or children of a divided list with 2+ visible items.
  const lists = [...document.querySelectorAll(ROW_LISTS)]
    .map((l) => [...l.children].filter(visible))
    .filter((rows) => rows.length >= 2)
  lists.sort((a, b) => a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top)
  const rows = lists[0] || []
  const first = rows[0]
  const firstTop = first ? Math.round(first.getBoundingClientRect().top) : null

  const bottomNav = [...document.querySelectorAll('nav')].find((n) => {
    const cs = getComputedStyle(n)
    const r = n.getBoundingClientRect()
    return cs.position === 'fixed' && r.bottom >= vh - 2 && r.height > 0 && visible(n)
  })
  const navH = bottomNav ? Math.round(bottomNav.getBoundingClientRect().height) : 0
  const topBar = [...document.querySelectorAll('header')].find((h) => {
    const cs = getComputedStyle(h); const r = h.getBoundingClientRect()
    return (cs.position === 'fixed' || cs.position === 'sticky') && r.top <= 1 && r.height > 0 && visible(h)
  })

  const interactive = [...document.querySelectorAll('main button, main input, main select, main a[href], main [role="tab"]')].filter(visible)
  const controlsAbove = firstTop == null ? null : interactive.filter((el) => el.getBoundingClientRect().bottom <= firstTop + 1).length

  const scrollers = [...document.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el)
    return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 80 && visible(el)
  }).map((el) => ({ tag: el.tagName.toLowerCase(), cls: (el.className?.toString() || '').slice(0, 80), h: el.clientHeight, sh: el.scrollHeight }))

  const rowInfo = rows.slice(0, 3).map((r) => ({
    h: Math.round(r.getBoundingClientRect().height),
    buttons: [...r.querySelectorAll('button, a[href]')].filter(visible).length,
  }))
  // Smallest rendered text inside the first rows (secondary text legibility).
  let minFont = null
  rows.slice(0, 3).forEach((r) => r.querySelectorAll('*').forEach((el) => {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (minFont == null || fs < minFont) minFont = fs
  }))

  return {
    vw, vh,
    docOverflowX: document.documentElement.scrollWidth > vw + 1,
    topBarH: topBar ? Math.round(topBar.getBoundingClientRect().height) : 0,
    bottomNavH: navH,
    rowsFound: rows.length,
    firstRowTop: firstTop,
    firstRowPctOfViewport: firstTop == null ? null : Math.round((firstTop / vh) * 100),
    controlsAbove,
    rowInfo,
    minFontInRows: minFont,
    scrollers,
    h1Count: document.querySelectorAll('main h1').length,
  }
}

for (const route of ROUTES) {
  test(`audit ${route}`, async ({ page }, info) => {
    const vp = info.project.name
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
    // Wait for a record list (up to 10s) so slow loads are not measured as empty pages.
    await page.waitForFunction((sel) => [...document.querySelectorAll(sel)]
      .some((l) => [...l.children].filter((c) => c.getBoundingClientRect().height > 0).length >= 2), ROW_LISTS, { timeout: 10_000 })
      .catch(() => {})
    await page.waitForTimeout(500)
    const before = await page.evaluate(measure, ROW_LISTS)
    await page.screenshot({ path: path.join(shotDir, `audit-${route.slice(1)}-${vp}.png`), fullPage: false })

    // Can a user reach the last record by wheel-scrolling over the list (no programmatic scroll)?
    let reach = null
    if (before.rowsFound >= 2) {
      const vh = before.vh
      const x = Math.round(before.vw / 2)
      const y = Math.min(vh - before.bottomNavH - 20, Math.max(before.firstRowTop + 10, 10))
      await page.mouse.move(x, y)
      for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 900)
      await page.waitForTimeout(400)
      reach = await page.evaluate(([navH, ROW_LISTS]) => {
        const vh = window.innerHeight
        const lists = [...document.querySelectorAll(ROW_LISTS)]
          .map((l) => [...l.children].filter((el) => el.getBoundingClientRect().height > 0))
          .filter((rows) => rows.length >= 2)
          .sort((a, b) => b.length - a.length)
        const rows = lists[0] || []
        const last = rows[rows.length - 1]
        if (!last) return null
        const r = last.getBoundingClientRect()
        return { lastRowBottom: Math.round(r.bottom), usableBottom: vh - navH, lastRowVisible: r.top < vh - navH && r.bottom > 0 }
      }, [before.bottomNavH, ROW_LISTS])
      await page.screenshot({ path: path.join(shotDir, `audit-${route.slice(1)}-${vp}-scrolled.png`), fullPage: false })
    }
    record(vp, { slug: SLUG, route, vp, ...before, wheelReach: reach })
  })
}

test('audit /expenses add form', async ({ page }, info) => {
  const vp = info.project.name
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  const add = page.getByRole('button', { name: /add expense/i }).first()
  if (!(await add.isVisible().catch(() => false))) { record(vp, { route: '/expenses#add', vp, note: 'Add expense button not visible' }); return }
  await add.click()
  await page.waitForTimeout(600)
  const facts = await page.evaluate(() => {
    const vh = window.innerHeight
    const dlg = document.querySelector('[role="dialog"], [aria-modal="true"]')
    const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom >= vh - 2 && n.getBoundingClientRect().height > 0)
    const save = [...document.querySelectorAll('button')].find((b) => /^(save|add expense|create)/i.test(b.textContent.trim()) && b.getBoundingClientRect().height > 0 && (!dlg || dlg.contains(b)))
    const sr = save?.getBoundingClientRect()
    const navTop = nav ? nav.getBoundingClientRect().top : vh
    const navZ = nav ? getComputedStyle(nav).zIndex : null
    const atSave = sr ? document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2) : null
    return {
      dialog: !!dlg,
      bottomNavVisible: !!nav,
      bottomNavZ: navZ,
      saveTop: sr ? Math.round(sr.top) : null,
      saveBottom: sr ? Math.round(sr.bottom) : null,
      saveInViewport: sr ? sr.top >= 0 && sr.bottom <= vh : false,
      saveCoveredByNav: sr ? sr.bottom > navTop && !!nav && nav.contains(atSave) : null,
      inputs: dlg ? dlg.querySelectorAll('input, select, textarea').length : null,
    }
  })
  await page.screenshot({ path: path.join(shotDir, `audit-expenses-add-${vp}.png`), fullPage: false })
  record(vp, { slug: SLUG, route: '/expenses#add', vp, ...facts })
})

test('audit /ledger with a customer selected', async ({ page }, info) => {
  const vp = info.project.name
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  // First real customer row in the picker (skip the Cash Customer option).
  const rows = page.locator('main div.p-1.space-y-0\\.5 > button')
  if ((await rows.count()) < 2) { record(vp, { route: '/ledger#selected', vp, note: 'no customers' }); return }
  await rows.nth(1).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  const facts = await page.evaluate(() => {
    const vh = window.innerHeight
    const btns = [...document.querySelectorAll('main button')].filter((b) => {
      const r = b.getBoundingClientRect(); return r.height > 0 && r.top < vh && r.bottom > 0
    })
    const iconOnly = btns.filter((b) => !b.textContent.trim())
    const unlabeled = iconOnly.filter((b) => !b.getAttribute('aria-label') && !b.getAttribute('title'))
    const tabs = [...document.querySelectorAll('main [role="tab"], main button')].find((b) => /^ledger$/i.test(b.textContent.trim()))
    return { visibleButtons: btns.length, iconOnlyButtons: iconOnly.length, iconOnlyWithoutLabel: unlabeled.length, ledgerTabTop: tabs ? Math.round(tabs.getBoundingClientRect().top) : null, vh }
  })
  await page.screenshot({ path: path.join(shotDir, `audit-ledger-selected-${vp}.png`), fullPage: false })
  record(vp, { slug: SLUG, route: '/ledger#selected', vp, ...facts })
})
