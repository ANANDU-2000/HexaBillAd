import test from 'node:test'
import assert from 'node:assert/strict'
import {
  syncExpensesSearchParams,
  readExpensesStateFromParams,
  buildDailyCloseHref
} from '../src/utils/expensesUrl.js'

test('expenses URL sync and read', () => {
  const params = new URLSearchParams()
  syncExpensesSearchParams(params, {
    dateRange: { from: '2026-01-01', to: '2026-01-31' },
    branchId: '3'
  })
  assert.equal(params.get('branchId'), '3')
  const parsed = readExpensesStateFromParams(params)
  assert.deepEqual(parsed.dateRange, { from: '2026-01-01', to: '2026-01-31' })
  assert.equal(parsed.branchId, '3')
})

test('buildDailyCloseHref passes date and branch', () => {
  assert.equal(
    buildDailyCloseHref({ businessDate: '2026-03-03', branchId: 2 }),
    '/daily-close?date=2026-03-03&branchId=2'
  )
})
