import test from 'node:test'
import assert from 'node:assert/strict'
import { syncDailyCloseSearchParams, readDailyCloseStateFromParams } from '../src/utils/dailyCloseUrl.js'

test('daily close URL sync preserves unrelated params', () => {
  const params = new URLSearchParams('foo=1')
  syncDailyCloseSearchParams(params, { businessDate: '2026-03-03', branchId: '7' })
  assert.equal(params.get('foo'), '1')
  assert.equal(params.get('date'), '2026-03-03')
  assert.equal(params.get('branchId'), '7')
  const parsed = readDailyCloseStateFromParams(params)
  assert.equal(parsed.businessDate, '2026-03-03')
  assert.equal(parsed.branchId, '7')
})
