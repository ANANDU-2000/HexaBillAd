import test from 'node:test'
import assert from 'node:assert/strict'
import { createScheduler, nextDelay, MAX_BACKOFF_MS, TYPING_PAUSE_MS } from '../src/services/scheduler.js'

// Manual clock + timer queue so the tests are deterministic.
function harness (envOverrides = {}) {
  let t = 0
  const timers = []
  const state = { hidden: false, offline: false, modal: false }
  const env = { hidden: () => state.hidden, offline: () => state.offline, modalOpen: () => state.modal, ...envOverrides }
  const s = createScheduler({
    now: () => t,
    setTimer: (fn, ms) => { const h = { fn, at: t + ms, dead: false }; timers.push(h); return h },
    clearTimer: (h) => { if (h) h.dead = true },
    random: () => 0.5, // jitter factor exactly 1
    env,
  })
  const advance = async (ms) => {
    const target = t + ms
    for (;;) {
      const due = timers.filter((h) => !h.dead && h.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      due.dead = true
      t = due.at
      await due.fn()
    }
    t = target
  }
  return { s, state, advance, now: () => t }
}

test('job runs once per interval', async () => {
  const h = harness()
  let runs = 0
  h.s.register('a', () => { runs += 1 }, { intervalMs: 60000 })
  await h.advance(59000); assert.equal(runs, 0)
  await h.advance(2000); assert.equal(runs, 1)
  await h.advance(60000); assert.equal(runs, 2)
})

test('pauses while hidden, offline, modal open, dirty, or typed within 10 s', async () => {
  const h = harness()
  let runs = 0
  h.s.register('a', () => { runs += 1 }, { intervalMs: 10000 })
  h.state.hidden = true
  await h.advance(30000); assert.equal(runs, 0)
  h.state.hidden = false; h.state.offline = true
  await h.advance(10000); assert.equal(runs, 0)
  h.state.offline = false; h.state.modal = true
  await h.advance(10000); assert.equal(runs, 0)
  h.state.modal = false; h.s.setDirty('form', true)
  await h.advance(10000); assert.equal(runs, 0)
  h.s.setDirty('form', false); h.s.noteTyping()
  assert.equal(h.s.pauseReason(), 'typing')
  await h.advance(TYPING_PAUSE_MS - 1000); assert.equal(runs, 0)
  await h.advance(4000); assert.equal(runs, 1)
})

test('errors back off exponentially up to 5 minutes and reset on success', async () => {
  assert.equal(nextDelay(60000, 0, () => 0.5), 60000)
  assert.equal(nextDelay(60000, 1, () => 0.5), 120000)
  assert.equal(nextDelay(60000, 10, () => 0.5), MAX_BACKOFF_MS)
  const h = harness()
  let fail = true; let runs = 0
  h.s.register('a', () => { runs += 1; if (fail) throw new Error('x') }, { intervalMs: 10000 })
  await h.advance(10000); assert.equal(runs, 1) // fails -> next in 20 s
  await h.advance(19000); assert.equal(runs, 1)
  await h.advance(1500); assert.equal(runs, 2) // fails -> next in 40 s
  fail = false
  await h.advance(40000); assert.equal(runs, 3) // succeeds -> back to 10 s
  await h.advance(10000); assert.equal(runs, 4)
})

test('jitter stays within +-10 percent and unregister stops the job', async () => {
  assert.equal(nextDelay(1000, 0, () => 0), 900)
  assert.equal(nextDelay(1000, 0, () => 1), 1100)
  const h = harness()
  let runs = 0
  const off = h.s.register('a', () => { runs += 1 }, { intervalMs: 1000 })
  off()
  await h.advance(10000); assert.equal(runs, 0)
  assert.deepEqual(h.s.jobNames(), [])
})
