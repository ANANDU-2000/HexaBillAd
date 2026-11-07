// Shared helpers for the perf specs (PERF-AND-E2E-CONTROL.md section 2). Local synthetic tenant only.
// Results are written as JSON under docs/uiux/evidence/2026-11-07/perf/ and merged by scripts/perf-report.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiLogin, API, EDGE, feOrigin } from '../session.js'

export { feOrigin }
export const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest-test'
const here = path.dirname(fileURLToPath(import.meta.url))
export const RESULT_DIR = path.resolve(here, '..', '..', '..', '..', 'docs', 'uiux', 'evidence', '2026-11-07', 'perf')
export const IDLE_MS = Number(process.env.PERF_IDLE_MS || 60000) // budget run: PERF_IDLE_MS=300000
export const TARGET = process.env.PERF_TARGET || 'dev' // dev = Vite dev server, preview = production build via vite preview

/** phone = viewport < 768. The phone profile is throttled: CPU 4x, Fast 4G (9 Mbps down, 170 ms RTT). */
export const isPhone = (info) => (info.project.use.viewport?.width ?? 1440) < 768
export const profileName = (info) => (isPhone(info) ? 'phone' : 'desktop')

export async function throttle (page, info) {
  if (!isPhone(info)) return null
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 170,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (9 * 1024 * 1024) / 8 / 3,
  })
  return cdp
}

/** Long-task observer + first-data-row detector, injected before any app script runs. */
export const INIT_SCRIPT = () => {
  const P = (window.__perf = { longtasks: [], firstRowAt: null, firstRowInfo: null, marks: {} })
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.longtasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* longtask unsupported */ }
  const EMPTY = /^(loading|no\s|nothing|empty|\s*$)/i
  const check = () => {
    if (P.firstRowAt != null) return
    // Card layouts (no table rows): a page can name a text pattern that only real data matches, e.g. an invoice number.
    if (window.__perfRowText) {
      const m = ((document.querySelector('main') || document.body).innerText || '').match(new RegExp(window.__perfRowText))
      if (m) { P.firstRowAt = performance.now(); P.firstRowInfo = `text: ${m[0]}`; return }
    }
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const sel = window.__perfRowSelector || 'tbody tr, [role="row"]:not([aria-rowindex="1"]), [data-row], [data-testid$="-row"], [data-testid*="row-"]'
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('thead')) continue
      const t = (el.textContent || '').trim()
      if (!t || EMPTY.test(t) || /skeleton|animate-pulse/.test(el.className || '')) continue
      if (el.querySelector('.animate-pulse')) continue
      if (!visible(el)) continue
      P.firstRowAt = performance.now()
      P.firstRowInfo = `${el.tagName.toLowerCase()}: ${t.replace(/\s+/g, ' ').slice(0, 60)}`
      return
    }
  }
  const mo = new MutationObserver(check)
  const start = () => { mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); check() }
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start)
}

/** Records API requests (fetch/xhr) with timing so idle counts, slow calls and per-phase counts are exact. */
export function trackRequests (page) {
  const log = []
  const t0 = 0 // epoch ms; use rel(origin) to convert to page time
  const open = new Map()
  page.on('request', (req) => {
    const u = new URL(req.url())
    const rec = { t: Date.now() - t0, method: req.method(), path: u.pathname + (u.search ? '?' + u.search.slice(1, 60) : ''), type: req.resourceType(), api: u.pathname.startsWith('/api/'), done: null }
    log.push(rec)
    open.set(req, rec)
  })
  const fin = (req) => { const r = open.get(req); if (r) r.done = Date.now() - t0 }
  page.on('requestfinished', fin)
  page.on('requestfailed', fin)
  return {
    log,
    mark: () => log.length,
    since: (i, filter = (r) => r.api) => log.slice(i).filter(filter),
    api: () => log.filter((r) => r.api),
    slow: (ms = 3000) => log.filter((r) => r.api && r.done != null && r.done - r.t > ms),
  }
}

export async function readPerf (page) {
  return page.evaluate(() => ({ ...window.__perf, now: Math.round(performance.now()) }))
}

export const longTaskStats = (tasks, fromMs = 0, toMs = Infinity) => {
  const inRange = tasks.filter((t) => t.start >= fromMs && t.start <= toMs)
  return { over50: inRange.length, over200: inRange.filter((t) => t.dur > 200).length, maxMs: inRange.reduce((m, t) => Math.max(m, t.dur), 0) }
}

export const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
export const p95 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] }

/** Saves one page/profile result. metrics: { name: number|null }, notes: free text, never invented. */
export function saveResult (page, profile, metrics, notes = {}) {
  fs.mkdirSync(RESULT_DIR, { recursive: true })
  const file = path.join(RESULT_DIR, `${profile}-${page}.json`)
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { metrics: {}, notes: {} }
  const out = {
    kind: 'e2e', page, profile, target: TARGET, generatedAt: new Date().toISOString(),
    metrics: { ...prev.metrics, ...metrics }, notes: { ...prev.notes, ...notes },
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
}

async function apiCall (path_) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path_}`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  const j = await r.json().catch(() => ({}))
  return j.data ?? j
}
const rowsOf = (d) => d?.items || d?.Items || (Array.isArray(d) ? d : [])

/** The seeded customer with the most invoices/balance, found through the app's own API. */
export async function pickLedgerCustomer () {
  const list = rowsOf(await apiCall('/api/customers?page=1&pageSize=100'))
  if (!list.length) return null
  const best = [...list].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0]
  return { id: best.id, name: best.name, balance: best.balance, customerCount: list.length }
}

export async function tenantSize () {
  const out = {}
  for (const [k, p] of [['customers', '/api/customers?page=1&pageSize=1'], ['products', '/api/products?page=1&pageSize=1'], ['sales', '/api/sales?page=1&pageSize=1']]) {
    try { const d = await apiCall(p); out[k] = d?.totalCount ?? d?.TotalCount ?? rowsOf(d).length } catch { out[k] = null }
  }
  return out
}

const SCALE_MAX = 1000

/**
 * Browser-only scaling: any GET /api JSON list (data.items / data.Items) is replicated up to its requested
 * pageSize (capped at 1000) with unique ids. No database writes. Used to expose client render/merge cost that a
 * 1-customer / 3-sale synthetic tenant hides. Responses without a list (reports, dashboard KPIs) pass through.
 */
export async function installScale (page) {
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const req = route.request()
    if (req.method() !== 'GET') return route.continue()
    let res
    try { res = await route.fetch() } catch { return route.continue().catch(() => {}) }
    const ct = res.headers()['content-type'] || ''
    if (!ct.includes('json')) return route.fulfill({ response: res })
    let json
    try { json = await res.json() } catch { return route.fulfill({ response: res }) }
    const u = new URL(req.url())
    const want = Math.min(Number(u.searchParams.get('pageSize') || u.searchParams.get('limit') || 0) || 0, SCALE_MAX)
    const d = json?.data ?? json?.Data
    const key = d && (Array.isArray(d.items) ? 'items' : Array.isArray(d.Items) ? 'Items' : null)
    if (key && want > d[key].length && d[key].length > 0) {
      const src = d[key]
      const out = []
      for (let i = 0; i < want; i++) {
        const base = JSON.parse(JSON.stringify(src[i % src.length]))
        if (i >= src.length) {
          for (const idKey of ['id', 'Id']) if (typeof base[idKey] === 'number') base[idKey] = base[idKey] + 1_000_000 + i
          for (const nameKey of ['nameEn', 'name']) if (typeof base[nameKey] === 'string') base[nameKey] = `${base[nameKey]} #${i}`
        }
        out.push(base)
      }
      d[key] = out
      for (const c of ['totalCount', 'TotalCount']) if (typeof d[c] === 'number') d[c] = Math.max(d[c], want)
    }
    return route.fulfill({ response: res, json })
  })
}

export const round =(n, d = 0) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d)
