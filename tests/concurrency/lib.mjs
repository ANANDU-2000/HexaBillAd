// Shared helpers for T5 concurrency scripts. Local synthetic API only (HEXABILL_API must be 127.0.0.1).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'

export const API = process.env.HEXABILL_API
export const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET
export const PASSWORD = process.env.HEXABILL_OWNER_PASSWORD
if (!API || !/^http:\/\/127\.0\.0\.1:\d+$/.test(API)) throw new Error('HEXABILL_API must be the local synthetic host')
if (process.env.PGPORT !== '55481' || !/^hexabill_codex_browser_/.test(process.env.PGDATABASE || '')) throw new Error('Local synthetic DB only')

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const uuid = () => crypto.randomUUID()

export function sql (text) {
  const out = execFileSync(process.env.HEXABILL_QA_PSQL, ['-X', '-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8' })
  return out.trim().split(/\r?\n/).filter(Boolean).map((l) => l.split('|'))
}
export const sql1 = (text) => (sql(text)[0] || [])[0]

/** One HTTP call with timing. Never throws on HTTP status; network errors are returned as status 0. */
export async function call (session, method, path, body, extraHeaders = {}) {
  const t0 = performance.now()
  let status = 0; let json = null; let err = null
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-HexaBill-Original-Host': `${session.slug}.localhost`,
        'X-HexaBill-Edge-Secret': EDGE,
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...extraHeaders,
      },
      ...(body !== undefined && body !== null ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60000),
    })
    status = res.status
    json = await res.json().catch(() => null)
  } catch (e) { err = String(e.cause?.code || e.message || e) }
  return { status, json, err, ms: performance.now() - t0, data: json?.data }
}

export async function login (slug, email, password = PASSWORD) {
  const s = { slug }
  let r
  for (let i = 0; i < 5; i++) {
    r = await call(s, 'POST', '/api/auth/login', { email, password })
    if (r.status < 500 && r.status !== 429) break
    await sleep(500 * (i + 1))
  }
  const d = r.data || {}
  const token = d.token || d.Token
  if (!token) throw new Error(`login ${email} failed: ${r.status} ${r.err || JSON.stringify(r.json).slice(0, 200)}`)
  return { slug, email, token, userId: d.userId ?? d.UserId, tenantId: d.tenantId ?? d.TenantId, role: d.role || d.Role }
}
export const ownerSession = (slug) => login(slug, `owner@${slug}.hexabill.local`)

export function pct (arr, p) {
  if (!arr.length) return 0
  const a = [...arr].sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)]
}
export const r2 = (n) => Math.round(n * 100) / 100

/** Summarise a list of call results. 5xx and network errors count as errors; `okStatuses` are expected statuses. */
export function summarize (results, okStatuses = [200, 201]) {
  const ms = results.map((r) => r.ms)
  const by = {}
  for (const r of results) by[r.status || r.err] = (by[r.status || r.err] || 0) + 1
  const serverErrors = results.filter((r) => r.status === 0 || r.status >= 500).length
  const unexpected = results.filter((r) => !okStatuses.includes(r.status)).length
  return { n: results.length, p50: r2(pct(ms, 50)), p95: r2(pct(ms, 95)), max: r2(Math.max(0, ...ms)), statuses: by, serverErrors, unexpected }
}

// The in-process API host writes nothing to stderr, so deadlocks and conflicts are read from PostgreSQL's own counters
// (pg_stat_database) before/after each run. Pool exhaustion shows up as 5xx/timeouts, which every scenario already checks.
const pgStats = () => { const [d, c] = sql('select deadlocks, conflicts from pg_stat_database where datname = current_database()')[0]; return { deadlocks: Number(d), conflicts: Number(c) } }
export function logOffset () { return pgStats() }
export function logDelta (from) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500) // let backends flush their stats
  const now = pgStats()
  return { deadlocks: now.deadlocks - from.deadlocks, serialization: now.conflicts - from.conflicts, poolExhausted: 0 }
}

/** Run `fns` all at once (released together after a barrier). */
export async function allAtOnce (fns) {
  let release; const gate = new Promise((r) => { release = r })
  const ps = fns.map(async (fn) => { await gate; return fn() })
  await sleep(50)
  release()
  return Promise.all(ps)
}
