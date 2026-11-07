// Perf baseline: API requests while /pos sits idle, plus JS heap growth over that window.
// Window = PERF_IDLE_MS (default 60000 for normal runs). The budget run (section 2: "idle 5 min") uses
// PERF_IDLE_MS=300000. Metric names carry the window so 60 s and 300 s results are never compared.
// The 30-minute / 100-invoice memory soak is NOT TESTED here: heap growth is a short-window proxy only.
import { test } from '@playwright/test'
import { signIn } from '../session.js'
import { SLUG, feOrigin, INIT_SCRIPT, IDLE_MS, throttle, trackRequests, saveResult, profileName, round } from './perfKit.js'

test('pos idle: API requests and heap growth', async ({ page }, info) => {
  test.setTimeout(IDLE_MS + 120_000)
  const profile = profileName(info)
  await signIn(page, SLUG)
  await page.addInitScript(INIT_SCRIPT)
  const cdp = (await throttle(page, info)) || (await page.context().newCDPSession(page))
  const tracker = trackRequests(page)
  await page.goto(`${feOrigin(SLUG)}/pos`, { waitUntil: 'domcontentloaded' })
  // Wait for the initial burst to finish; idle counting starts after 800 ms without a request in flight.
  let quiet = Date.now()
  for (let i = 0; i < 300; i++) {
    if (tracker.api().some((r) => r.done == null)) quiet = Date.now()
    else if (Date.now() - quiet > 800 && i > 20) break
    await page.waitForTimeout(100)
  }
  const heap = async () => {
    await cdp.send('HeapProfiler.enable').catch(() => {})
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {})
    const m = await cdp.send('Runtime.getHeapUsage').catch(() => null)
    return m ? m.usedSize / (1024 * 1024) : null
  }
  const heap0 = await heap()
  const mark = tracker.mark()
  const started = Date.now()
  await page.waitForTimeout(IDLE_MS)
  const reqs = tracker.since(mark)
  const heap1 = await heap()
  const sec = Math.round(IDLE_MS / 1000)
  const byPath = {}
  for (const r of reqs) { const k = `${r.method} ${r.path.split('?')[0]}`; byPath[k] = (byPath[k] || 0) + 1 }
  saveResult('posIdle', profile, {
    [`idleApiRequests${sec}s`]: reqs.length,
    [`idleHeapGrowthMb${sec}s`]: heap0 != null && heap1 != null ? round(heap1 - heap0, 2) : null,
  }, {
    idleWindowMs: Date.now() - started,
    idleRequestsByEndpoint: byPath,
    budget: 'idle 5 min on POS <= 6 requests (run with PERF_IDLE_MS=300000); 30 min soak NOT TESTED',
  })
})
