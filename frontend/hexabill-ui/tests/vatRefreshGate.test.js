import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRunBackgroundRefresh, vatPeriodKey } from '../src/utils/vatRefreshGate.js'

const base = { inFlight: false, lastKey: 'a|b', lastAt: 1000, key: 'a|b', now: 2000 }

test('no passive refetch while a request is in flight', () => {
  assert.equal(shouldRunBackgroundRefresh({ ...base, inFlight: true, now: 999999 }), false)
})
test('same period just loaded is not refetched by focus or visibility', () => {
  assert.equal(shouldRunBackgroundRefresh(base), false)
})
test('same period after the interval, or a different period, may refetch', () => {
  assert.equal(shouldRunBackgroundRefresh({ ...base, now: 1000 + 30000 }), true)
  assert.equal(shouldRunBackgroundRefresh({ ...base, key: 'c|d' }), true)
})
test('never loaded yet may fetch', () => {
  assert.equal(shouldRunBackgroundRefresh({ inFlight: false, lastKey: null, lastAt: NaN, key: 'a|b', now: 1 }), true)
})
test('period key is stable', () => assert.equal(vatPeriodKey('2026-02-01', '2026-04-30'), '2026-02-01|2026-04-30'))
