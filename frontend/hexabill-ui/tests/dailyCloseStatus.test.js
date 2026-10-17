import test from 'node:test'
import assert from 'node:assert/strict'
import { describeDailyClose } from '../src/features/dashboard/dailyCloseStatus.js'

test('a failed load is unavailable, never closed', () => {
  assert.equal(describeDailyClose({ error: true }).key, 'unavailable')
  assert.equal(describeDailyClose(null).key, 'unavailable')
})
test('no row today is not closed', () => assert.equal(describeDailyClose({ current: null }).key, 'not-started'))
test('draft is not closed', () => assert.equal(describeDailyClose({ current: { status: 'Draft', variance: 0 } }).key, 'draft'))
test('closed with matching cash is success', () => {
  const r = describeDailyClose({ current: { status: 'Closed', variance: 0, closedAt: '2026-10-17T18:00:00Z' } })
  assert.equal(r.key, 'closed'); assert.equal(r.tone, 'success')
})
test('closed with an unexplained variance is a warning; explained stays success', () => {
  assert.equal(describeDailyClose({ current: { status: 'Closed', variance: -5 } }).tone, 'warning')
  assert.equal(describeDailyClose({ current: { status: 'Closed', variance: -5, varianceReason: 'Change owed' } }).tone, 'success')
})
test('reopened row shows its reason', () => {
  const r = describeDailyClose({ current: { status: 'Draft', reopenedAt: '2026-10-17T19:00:00Z', reopenReason: 'Late invoice' } })
  assert.equal(r.key, 'reopened'); assert.match(r.detail, /Late invoice/)
})
