import test from 'node:test'
import assert from 'node:assert/strict'
import { dubaiToday, resolvePeriod, daysInRange, isIsoDate } from '../src/utils/businessDateRange.js'

// 1 Nov 2026 10:00 Dubai
const NOV1 = new Date('2026-11-01T06:00:00Z')

test('dubaiToday uses Asia/Dubai, not UTC or the browser zone', () => {
  assert.equal(dubaiToday(NOV1), '2026-11-01')
  // 31 Oct 21:30 UTC is already 1 Nov 01:30 in Dubai
  assert.equal(dubaiToday(new Date('2026-10-31T21:30:00Z')), '2026-11-01')
  // 31 Oct 19:59 UTC is still 31 Oct 23:59 in Dubai
  assert.equal(dubaiToday(new Date('2026-10-31T19:59:00Z')), '2026-10-31')
})

test('presets match the verified 1 Nov 2026 reference dates', () => {
  assert.deepEqual(resolvePeriod('today', NOV1), { from: '2026-11-01', to: '2026-11-01' })
  assert.deepEqual(resolvePeriod('yesterday', NOV1), { from: '2026-10-31', to: '2026-10-31' })
  assert.deepEqual(resolvePeriod('week', NOV1), { from: '2026-10-26', to: '2026-11-01' })
  assert.deepEqual(resolvePeriod('last30', NOV1), { from: '2026-10-03', to: '2026-11-01' })
  assert.deepEqual(resolvePeriod('month', NOV1), { from: '2026-11-01', to: '2026-11-01' })
  assert.deepEqual(resolvePeriod('lastMonth', NOV1), { from: '2026-10-01', to: '2026-10-31' })
  assert.deepEqual(resolvePeriod('all', NOV1), { from: '', to: '' })
  assert.equal(resolvePeriod('custom', NOV1), null)
})

test('rolling week has exactly seven day buckets and never starts on 25 Oct', () => {
  const { from, to } = resolvePeriod('week', NOV1)
  assert.equal(daysInRange(from, to), 7)
  assert.notEqual(from, '2026-10-25')
  assert.equal(daysInRange(...Object.values(resolvePeriod('last30', NOV1))), 30)
})

test('year and leap boundaries', () => {
  const jan1 = new Date('2027-01-01T08:00:00Z')
  assert.deepEqual(resolvePeriod('lastMonth', jan1), { from: '2026-12-01', to: '2026-12-31' })
  assert.deepEqual(resolvePeriod('yesterday', jan1), { from: '2026-12-31', to: '2026-12-31' })
  const mar1Leap = new Date('2028-03-01T08:00:00Z')
  assert.deepEqual(resolvePeriod('lastMonth', mar1Leap), { from: '2028-02-01', to: '2028-02-29' })
})

test('isIsoDate rejects malformed and impossible dates', () => {
  assert.equal(isIsoDate('2026-11-01'), true)
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('01/11/2026'), false)
  assert.equal(isIsoDate(''), false)
  assert.equal(isIsoDate(null), false)
})
