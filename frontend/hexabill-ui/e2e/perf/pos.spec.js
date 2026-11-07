// Perf baseline for /pos: ready-to-search, keystroke -> result list, add item -> total updated, long tasks.
// Timings are DOM-update latencies measured inside the page (MutationObserver), so they exclude paint.
// "scaled" variant: product list responses are replicated to their requested pageSize (max 1000) in the browser
// only, so the local filter and render cost of a real catalogue shows up. No database writes.
import { test } from '@playwright/test'
import { signIn, apiLogin, API, EDGE } from '../session.js'
import {
  SLUG, feOrigin, INIT_SCRIPT, throttle, trackRequests, readPerf, longTaskStats, saveResult,
  profileName, median, p95, round, installScale, tenantSize,
} from './perfKit.js'

test.describe.configure({ mode: 'serial' })

const POS_INIT = () => {
  const w = (window.__pos = { addBtnAt: null, drawerClickAt: null, drawerReadyAt: null, keys: [], addClickAt: null, totalBefore: null, totalAt: null })
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const readTotal = () => {
    for (const el of document.querySelectorAll('span, p, div')) {
      if (el.children.length === 0 && el.textContent.trim() === 'Grand Total' && vis(el)) {
        const m = (el.parentElement?.innerText || '').match(/-?[\d,]+\.\d{2}/g)
        if (m) return Number(m[m.length - 1].replace(/,/g, ''))
      }
    }
    return null
  }
  window.__posReadTotal = readTotal
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button')
    if (!b) return
    if (/^(Add Row|Add Product to Bill)$/.test(b.textContent.trim())) w.drawerClickAt = performance.now()
    if (b.closest('[data-product-picker]') && !b.getAttribute('aria-label') && /\d/.test(b.textContent)) {
      w.addClickAt = performance.now(); w.totalBefore = readTotal(); w.totalAt = null
    }
  }, true)
  document.addEventListener('keydown', (e) => {
    if (e.target?.matches?.('input[aria-label="Search products"]')) w.keys.push({ t0: performance.now(), t1: null, key: e.key })
  }, true)
  const mo = new MutationObserver((records) => {
    const now = performance.now()
    if (w.addBtnAt == null) {
      for (const b of document.querySelectorAll('button')) {
        if (/^(Add Row|Add Product to Bill)$/.test(b.textContent.trim()) && vis(b) && !b.disabled) { w.addBtnAt = now; break }
      }
    }
    const inp = document.querySelector('input[aria-label="Search products"]')
    if (w.drawerClickAt != null && w.drawerReadyAt == null && inp && !inp.disabled && vis(inp)) w.drawerReadyAt = now
    const inDrawerList = records.some((r) => {
      const t = r.target.nodeType === 1 ? r.target : r.target.parentElement
      return t && t.closest && t.closest('[data-product-picker]') && t.tagName !== 'INPUT'
    })
    // A key only counts if the list changed within 600 ms of it; later changes belong to later keys.
    // The change belongs to the latest key typed before it; older unresolved keys are superseded (t1 = -1).
    if (inDrawerList) {
      const pending = w.keys.filter((k) => k.t1 == null && now >= k.t0 && now - k.t0 <= 600)
      pending.forEach((k, i) => { k.t1 = i === pending.length - 1 ? now : -1 })
    }
    if (w.addClickAt != null && w.totalAt == null) {
      const t = readTotal()
      if (t != null && t !== w.totalBefore) w.totalAt = now
    }
  })
  const start = () => mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true })
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start)
}

async function pickProduct () {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}/api/products?page=1&pageSize=100`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  const j = await r.json().catch(() => ({}))
  const items = j.data?.items || j.data?.Items || []
  return items.find((p) => Number(p.sellPrice) > 0 && Number(p.stockQty) > 0) || items[0] || null
}

for (const scaled of [false, true]) {
  test(`pos${scaled ? ' (scaled catalogue)' : ''}: ready to search, keystroke, add item`, async ({ page }, info) => {
    test.setTimeout(150_000)
    const profile = profileName(info)
    const key = scaled ? 'posScaled' : 'pos'
    const product = await pickProduct()
    test.skip(!product, 'no sellable product found through the API')
    await signIn(page, SLUG)
    await page.addInitScript(INIT_SCRIPT)
    await page.addInitScript(POS_INIT)
    await throttle(page, info)
    if (scaled) await installScale(page)
    const tracker = trackRequests(page)

    await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'domcontentloaded' })
    const origin = await page.evaluate(() => performance.timeOrigin)
    // Ready to search = add-product control usable AND the product catalogue request(s) finished.
    for (let i = 0; i < 400; i++) { if ((await page.evaluate(() => window.__pos.addBtnAt)) != null) break; await page.waitForTimeout(50) }
    let quiet = Date.now()
    for (let i = 0; i < 300; i++) {
      if (tracker.api().some((r) => r.done == null)) quiet = Date.now()
      else if (Date.now() - quiet > 800) break
      await page.waitForTimeout(100)
    }
    const addBtnAt = await page.evaluate(() => window.__pos.addBtnAt)
    const productReqs = tracker.api().filter((r) => /\/api\/products/.test(r.path))
    const productsDone = Math.max(0, ...productReqs.map((r) => r.done || 0)) - origin
    const readyMs = addBtnAt == null ? null : Math.max(addBtnAt, productsDone)
    await page.screenshot({ path: `e2e/.shots/perf-${profile}-${key}-ready.png` })

    // Interaction window starts at the drawer click.
    const t0 = (await readPerf(page)).now
    const reqMark = tracker.mark()
    const apiOnLoad = tracker.api().length
    const productCalls = productReqs.map((r) => r.path)
    const addControl = page.getByRole('button', { name: /^(Add Row|Add Product to Bill)$/ }).filter({ visible: true }).first()
    await addControl.click()
    await page.getByLabel('Search products').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(300)
    const drawerMs = await page.evaluate(() => (window.__pos.drawerReadyAt == null ? null : window.__pos.drawerReadyAt - window.__pos.drawerClickAt))

    const search = page.getByLabel('Search products')
    const term = String(product.nameEn || product.name || 'a').slice(0, 5)
    // Scaled catalogue: replicas are named "<name> #<n>", so the suffix narrows ~200 -> ~100 -> ~11 rows per key.
    const typed = scaled ? `${term} #19` : term
    await search.pressSequentially(typed, { delay: 150 })
    await page.waitForTimeout(500)
    for (let i = 0; i < typed.length; i++) { await search.press('Backspace'); await page.waitForTimeout(150) }
    await search.pressSequentially('zzq', { delay: 150 })
    await page.waitForTimeout(500)
    for (let i = 0; i < 3; i++) { await search.press('Backspace'); await page.waitForTimeout(150) }
    await page.waitForTimeout(600)
    const keyReqs = tracker.since(reqMark)
    const keys = await page.evaluate(() => window.__pos.keys.map((k) => ({ key: k.key, ms: k.t1 == null || k.t1 < 0 ? null : k.t1 - k.t0 })))
    const keyMs = keys.filter((k) => k.ms != null).map((k) => k.ms)

    // Add item -> total updated (twice: a new line each time).
    const addMs = []
    const items = page.locator('[data-product-picker] button').filter({ hasText: /\d/ }).filter({ hasNotText: /^Back|^Next|Close/ })
    for (let n = 0; n < 2; n++) {
      if (n > 0) {
        await page.getByRole('button', { name: /^(Add Row|Add Product to Bill)$/ }).filter({ visible: true }).first().click()
        await page.getByLabel('Search products').waitFor({ state: 'visible', timeout: 10_000 })
        await page.waitForTimeout(300)
      }
      await items.first().click()
      for (let i = 0; i < 60; i++) { if ((await page.evaluate(() => window.__pos.totalAt)) != null) break; await page.waitForTimeout(50) }
      const r = await page.evaluate(() => ({ ms: window.__pos.totalAt == null ? null : window.__pos.totalAt - window.__pos.addClickAt }))
      addMs.push(r.ms)
      await page.waitForTimeout(400)
    }
    await page.screenshot({ path: `e2e/.shots/perf-${profile}-${key}-after-add.png` })
    const after = await readPerf(page)
    const lt = longTaskStats(after.longtasks, t0, Infinity)
    const loadLt = longTaskStats(after.longtasks, 0, t0)
    const okAdd = addMs.filter((x) => x != null)

    saveResult(key, profile, {
      readyToSearchMs: round(readyMs),
      drawerOpenMs: round(drawerMs),
      keystrokeToListMedianMs: round(median(keyMs), 1),
      keystrokeToListP95Ms: round(p95(keyMs), 1),
      keystrokeToListMaxMs: keyMs.length ? round(Math.max(...keyMs), 1) : null,
      addItemToTotalMs: okAdd.length ? round(Math.max(...okAdd), 1) : null,
      longTasksOver200Interaction: lt.over200,
      longTasksOver50Interaction: lt.over50,
      longTaskMaxMsInteraction: lt.maxMs,
      longTasksOver200OnLoad: loadLt.over200,
      longTaskMaxMsOnLoad: loadLt.maxMs,
      apiRequestsOnLoad: apiOnLoad,
      apiRequestsWhileTyping: keyReqs.length,
    }, {
      scaled,
      productRequests: productCalls,
      product: product.nameEn || product.name,
      keystrokesMeasured: `${keyMs.length} of ${keys.length} keys changed the list (others left the DOM unchanged)`,
      keystrokeDetail: keys,
      addItemSamplesMs: addMs,
      readyDefinition: 'max(add-product control usable, last /api/products response done), ms from navigation start',
      tenantSize: await tenantSize(),
      idleAndSoak: 'see pos-idle.spec.js; 30 min / 100-invoice soak NOT TESTED',
    })
  })
}
