// T4 bug hunt 1: Daily close and cash drawer movements, API edge inputs. Needs the daily_close feature flag on the
// synthetic tenant (the runner script turns it on and back off; the seed refuses password rotation otherwise).
import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function raw (path, method = 'GET', body) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { method,
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json, data: json.data }
}
const is4xx = (r, label) => { expect(r.status, `${label} ${JSON.stringify(r.json).slice(0, 160)}`).toBeGreaterThanOrEqual(400); expect(r.status, label).toBeLessThan(500) }
// Each test uses its own old date so nothing collides with other specs.
// The seed refuses to rotate its password when the flag is set, so switch it on inside the run and off after.
const setFlag = (json) => execFileSync(process.env.HEXABILL_QA_PSQL, ['-c', `update "Tenants" set "FeaturesJson"='${json}' where "Subdomain"='${SLUG}'`])
test.beforeAll(() => setFlag('["daily_close"]'))
test.afterAll(() => setFlag('[]'))
const day = (n) => `2019-03-${String(n).padStart(2, '0')}`

test('flag is on for this run', async () => {
  const r = await raw(`/api/daily-close/status?businessDate=${day(1)}`)
  expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBe(200)
})

test('preview with absurd inputs never returns 5xx', async () => {
  for (const q of ['businessDate=0001-01-01', 'businessDate=9999-12-31', `businessDate=${day(2)}&openingCash=-1`, `businessDate=${day(2)}&openingCash=1000000000000`, 'businessDate=notadate']) {
    const r = await raw(`/api/daily-close/preview?${q}`)
    expect(r.status, q).toBeLessThan(500)
  }
})

test('close: negative or absurd counted cash is 4xx; variance without reason is 4xx', async () => {
  is4xx(await raw('/api/daily-close', 'POST', { businessDate: day(3), openingCash: 0, countedCash: -5, submitClose: true }), 'negative counted')
  is4xx(await raw('/api/daily-close', 'POST', { businessDate: day(3), openingCash: 0, countedCash: 100, submitClose: true }), 'variance no reason')
  is4xx(await raw('/api/daily-close', 'POST', { businessDate: day(3), openingCash: -50, countedCash: 0, submitClose: true }), 'negative opening cash')
})

test('close: five concurrent submits produce one closed record and no 5xx', async () => {
  const body = { businessDate: day(4), openingCash: 0, countedCash: 0, submitClose: true }
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => raw('/api/daily-close', 'POST', body)))
  expect(rs.filter((r) => r.status >= 500).map((r) => `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`)).toEqual([])
  const hist = await raw('/api/daily-close/history?from=2019-03-01&to=2019-03-31')
  const list = Array.isArray(hist.data) ? hist.data : (hist.data?.items || [])
  expect(list.filter((c) => String(c.businessDate).startsWith(day(4))).length).toBeLessThanOrEqual(1)
  await raw('/api/daily-close/reopen', 'POST', { businessDate: day(4), reason: 'hunt cleanup' })
})

test('movements: zero/negative/1e9 amounts and unknown kind are 4xx; no movement can be added to a closed day', async () => {
  const mv = (over) => raw('/api/daily-close/movements', 'POST', { businessDate: day(5), kind: 'CashIn', amount: 10, note: 'hunt', movementDate: `${day(5)}T08:00:00Z`, ...over })
  is4xx(await mv({ amount: 0 }), 'amount 0')
  is4xx(await mv({ amount: -10 }), 'amount -10')
  is4xx(await mv({ kind: 'Bogus' }), 'unknown kind')
  is4xx(await mv({ note: 'x'.repeat(5000) }), '5000-char note')
  const big = await mv({ amount: 1e12 })
  is4xx(big, 'amount 1e12')
  await raw('/api/daily-close', 'POST', { businessDate: day(5), openingCash: 0, countedCash: 0, submitClose: true })
  is4xx(await mv({}), 'movement on closed day')
  await raw('/api/daily-close/reopen', 'POST', { businessDate: day(5), reason: 'hunt cleanup' })
})

test('reopen: a day that was never closed and a too-short reason are 4xx', async () => {
  is4xx(await raw('/api/daily-close/reopen', 'POST', { businessDate: day(6), reason: 'ok reason' }), 'reopen never-closed')
  is4xx(await raw('/api/daily-close/reopen', 'POST', { businessDate: day(6), reason: '' }), 'empty reason')
})
