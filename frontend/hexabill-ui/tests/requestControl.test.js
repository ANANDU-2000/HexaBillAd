import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestController, isAbortLike } from '../src/services/requestControl.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

test('a newer start aborts the older one and only the latest is current', () => {
  const c = createRequestController()
  const a = c.start()
  const b = c.start()
  assert.equal(a.signal.aborted, true)
  assert.equal(a.isCurrent(), false)
  assert.equal(b.isCurrent(), true)
  assert.equal(a.classify(new Error('x')), 'superseded')
  c.dispose()
})

test('last response wins when responses arrive out of order', async () => {
  const c = createRequestController()
  const applied = []
  const run = async (label, delay) => {
    const t = c.start()
    await wait(delay)
    if (!t.isCurrent()) return
    applied.push(label)
    t.finish()
  }
  await Promise.all([run('first', 40), run('second', 5)])
  assert.deepEqual(applied, ['second'])
  c.dispose()
})

test('slow phase after slowMs, timedOut after timeoutMs', async () => {
  const phases = []
  const c = createRequestController({ slowMs: 20, timeoutMs: 60, onChange: (p) => phases.push(p) })
  const t = c.start()
  await wait(35)
  assert.equal(c.getPhase(), 'slow')
  await wait(60)
  assert.equal(c.getPhase(), 'timedOut')
  assert.equal(t.signal.aborted, true)
  assert.equal(t.classify(new Error('aborted')), 'timedOut')
  assert.deepEqual(phases, ['loading', 'slow', 'timedOut'])
  c.dispose()
})

test('fast request never shows the slow phase', async () => {
  const phases = []
  const c = createRequestController({ slowMs: 30, timeoutMs: 90, onChange: (p) => phases.push(p) })
  const t = c.start()
  await wait(5)
  t.finish()
  await wait(50)
  assert.deepEqual(phases, ['loading', 'idle'])
  c.dispose()
})

test('cancel aborts and classifies as cancelled; ECONNABORTED classifies as timedOut', () => {
  const c = createRequestController()
  const t = c.start()
  c.cancel()
  assert.equal(t.signal.aborted, true)
  assert.equal(t.classify({ code: 'ERR_CANCELED' }), 'cancelled')
  assert.equal(c.getPhase(), 'cancelled')
  const t2 = c.start()
  assert.equal(t2.classify({ code: 'ECONNABORTED' }), 'timedOut')
  const t3 = c.start()
  assert.equal(t3.classify(new Error('boom')), 'error')
  c.dispose()
})

test('isAbortLike', () => {
  assert.equal(isAbortLike({ name: 'AbortError' }), true)
  assert.equal(isAbortLike({ code: 'ERR_CANCELED' }), true)
  assert.equal(isAbortLike(new Error('x')), false)
  assert.equal(isAbortLike(null), false)
})
