// Perf baseline: load + interaction metrics for the list/ledger/report pages (PERF-AND-E2E-CONTROL.md section 2).
// Local synthetic tenant only. Run through the loop wrapper (see docs/uiux/evidence/2026-11-07/perf/README.md).
// Profiles: d1440 = desktop normal; m360 = phone, CPU 4x + Fast 4G (applied by throttle()).
import { test } from '@playwright/test'
import { signIn } from '../session.js'
import {
  SLUG, feOrigin, INIT_SCRIPT, throttle, trackRequests, readPerf, longTaskStats, saveResult,
  profileName, pickLedgerCustomer, tenantSize, round, installScale,
} from './perfKit.js'

test.describe.configure({ mode: 'serial' })

const PAGES = [
  { key: 'ledger', path: (c) => `/ledger?customerId=${c.id}`, rows: true, rowText: String.raw`[A-Za-z]-\d{3,}` },
  { key: 'salesLedger', path: () => '/sales-ledger', rows: true, rowText: String.raw`[A-Za-z]-\d{3,}` },
  { key: 'billingHistory', path: () => '/billing-history', rows: true, rowText: String.raw`[A-Za-z]-\d{3,}` },
  { key: 'reports', path: () => '/reports', rows: false },
  { key: 'dashboard', path: () => '/dashboard', rows: false },
]

let customer
test.beforeAll(async () => {
  customer = await pickLedgerCustomer()
})

async function waitSettled (page, tracker, maxMs = 25000) {
  const start = Date.now()
  let quietSince = Date.now()
  while (Date.now() - start < maxMs) {
    const pending = tracker.api().some((r) => r.done == null)
    if (pending) quietSince = Date.now()
    else if (Date.now() - quietSince > 800) return true
    await page.waitForTimeout(100)
  }
  return false
}

/** Scroll, click tab-like controls, type in the first search box. Returns what was exercised. */
async function interact (page) {
  const did = []
  const vis = (loc) => loc.filter({ visible: true })
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(120) }
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -500); await page.waitForTimeout(120) }
  did.push('scroll x8')
  const tabs = vis(page.getByRole('tab'))
  const n = Math.min(await tabs.count(), 6)
  const names = []
  for (let i = 0; i < n; i++) {
    try { names.push((await tabs.nth(i).innerText()).trim().slice(0, 20)); await tabs.nth(i).click({ timeout: 2000 }); await page.waitForTimeout(500) } catch { /* control not clickable */ }
  }
  if (names.length) did.push(`tabs: ${names.join('|')}`)
  const search = vis(page.locator('input[type="search"], input[placeholder*="earch" i]')).first()
  if (await search.count()) {
    try {
      await search.click({ timeout: 2000 })
      await search.pressSequentially('abc', { delay: 100 })
      await page.waitForTimeout(600)
      await search.fill('')
      await page.waitForTimeout(600)
      did.push('search type abc + clear')
    } catch { /* search not interactable */ }
  }
  return did
}

for (const pg of PAGES) {
  // scaled = list responses are replicated up to the requested pageSize (max 1000) in the browser only, so the
  // client render/merge cost of a full tenant is measured without writing to the database.
  for (const scaled of [false, true]) test(`${pg.key}${scaled ? ' (scaled list data)' : ''}: load + interaction`, async ({ page }, info) => {
    test.setTimeout(150_000)
    test.skip(!customer && pg.key === 'ledger', 'no seeded customer found through the API')
    const profile = profileName(info)
    await signIn(page, SLUG)
    if (pg.rowText) await page.addInitScript((re) => { window.__perfRowText = re }, pg.rowText)
    await page.addInitScript(INIT_SCRIPT)
    await throttle(page, info)
    if (scaled) await installScale(page)
    const tracker = trackRequests(page)

    await page.goto(`${feOrigin(SLUG)}${pg.path(customer)}`, { waitUntil: 'domcontentloaded' })
    const origin = await page.evaluate(() => performance.timeOrigin)
    let firstRow = null
    for (let i = 0; pg.rows && i < 300 && firstRow == null; i++) {
      firstRow = (await readPerf(page)).firstRowAt
      if (firstRow == null) await page.waitForTimeout(50)
    }
    const settled = await waitSettled(page, tracker)
    const afterLoad = await readPerf(page)
    const apiLoad = tracker.api()
    const lastDone = Math.max(0, ...apiLoad.map((r) => r.done || 0))
    const loadTasks = longTaskStats(afterLoad.longtasks, 0, afterLoad.now)

    const reqBeforeInteract = tracker.mark()
    await page.screenshot({ path: `e2e/.shots/perf-${profile}-${pg.key}${scaled ? '-scaled' : ''}-loaded.png` })
    const interactFrom = afterLoad.now
    const did = await interact(page)
    const afterInteract = await readPerf(page)
    const inter = longTaskStats(afterInteract.longtasks, interactFrom, Infinity)

    saveResult(pg.key + (scaled ? 'Scaled' : ''), profile, {
      firstDataRowMs: pg.rows ? round(firstRow) : null,
      apiSettledMs: settled ? round(lastDone - origin) : null,
      apiRequestsOnLoad: apiLoad.length,
      longTasksOver200OnLoad: loadTasks.over200,
      longTasksOver50OnLoad: loadTasks.over50,
      longTaskMaxMsOnLoad: loadTasks.maxMs,
      longTasksOver200Interaction: inter.over200,
      longTasksOver50Interaction: inter.over50,
      longTaskMaxMsInteraction: inter.maxMs,
      apiRequestsInteraction: tracker.since(reqBeforeInteract).length,
      slowRequestsOver3s: tracker.slow(3000).length,
    }, {
      route: pg.path(customer || { id: '?' }),
      firstRowDetected: pg.rows ? afterLoad.firstRowInfo : 'not measured: landing view has no list rows',
      firstDataRowMs: pg.rows && firstRow == null ? 'NOT MEASURED: no data row appeared within 15 s' : undefined,
      interaction: did.join('; '),
      tenantSize: await tenantSize(),
      ledgerCustomer: customer ? { id: customer.id, balance: customer.balance } : null,
      apiCalls: apiLoad.map((r) => `${r.method} ${r.path}`).slice(0, 40),
    })
  })

  // Budget row: "Any request without a visible state after 3 s". Every non-auth GET is held for 4.5 s;
  // at 3.5 s we record whether the page shows any loading state and whether it offers "Still loading... Cancel".
  test(`${pg.key}: visible state while an API call takes > 3 s`, async ({ page }, info) => {
    test.setTimeout(120_000)
    test.skip(!customer && pg.key === 'ledger', 'no seeded customer found through the API')
    const profile = profileName(info)
    await signIn(page, SLUG)
    await throttle(page, info)
    const SKIP = /\/api\/(auth|branding|tenant|settings|users\/me|company)/i
    await page.route((u) => u.pathname.startsWith('/api/') && !SKIP.test(u.pathname), async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await new Promise((r) => setTimeout(r, 4500))
      return route.continue().catch(() => {})
    })
    await page.goto(`${feOrigin(SLUG)}${pg.path(customer)}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3600)
    await page.screenshot({ path: `e2e/.shots/perf-${profile}-${pg.key}-at3s.png` })
    const state = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      // Page content only (the app shell/sidebar is not the page's own loading state).
      const root = document.querySelector('main') || document.body
      const spinner = [...root.querySelectorAll('.animate-spin, .animate-pulse, [role="status"], [aria-busy="true"], [data-testid*="skeleton" i], [data-testid*="loading" i]')].some(vis)
      const body = root.innerText
      return {
        loadingIndicator: spinner || /loading/i.test(body),
        stillLoadingCancel: /still loading|taking longer/i.test(body) && /cancel/i.test(body),
        bodySample: body.replace(/\s+/g, ' ').slice(0, 160),
      }
    })
    saveResult(pg.key, profile, {
      noVisibleLoadingStateAt3s: state.loadingIndicator ? 0 : 1,
      stillLoadingCancelMissingAt3s: state.stillLoadingCancel ? 0 : 1,
    }, { slowStateProbe: state.bodySample })
  })
}
