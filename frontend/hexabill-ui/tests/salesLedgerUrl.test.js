import test from 'node:test'
import assert from 'node:assert/strict'
import {
  syncSalesLedgerSearchParams,
  readSalesLedgerStateFromParams,
  SALES_LEDGER_FILTER_KEYS
} from '../src/utils/salesLedgerUrl.js'

test('syncSalesLedgerSearchParams omits empty filters', () => {
  const params = new URLSearchParams('name=old&overdue=1')
  syncSalesLedgerSearchParams(params, {
    dateRange: { from: '2026-03-01', to: '2026-03-31' },
    overdueOnly: false,
    sortOrder: 'oldest',
    filters: { name: 'Acme', type: '', branchId: '2' }
  })
  assert.equal(params.get('from'), '2026-03-01')
  assert.equal(params.get('sort'), 'oldest')
  assert.equal(params.get('name'), 'Acme')
  assert.equal(params.get('branchId'), '2')
  assert.equal(params.has('overdue'), false)
  assert.equal(params.has('type'), false)
})

test('readSalesLedgerStateFromParams round-trips filter keys', () => {
  const params = new URLSearchParams()
  syncSalesLedgerSearchParams(params, {
    dateRange: { from: '2026-01-01', to: '2026-01-31' },
    overdueOnly: true,
    sortOrder: 'newest',
    filters: SALES_LEDGER_FILTER_KEYS.reduce((acc, k, i) => {
      acc[k] = i === 0 ? '2026-01-15' : `v-${k}`
      return acc
    }, {})
  })
  const parsed = readSalesLedgerStateFromParams(params)
  assert.deepEqual(parsed.dateRange, { from: '2026-01-01', to: '2026-01-31' })
  assert.equal(parsed.overdueOnly, true)
  assert.equal(parsed.sortOrder, 'newest')
  assert.equal(parsed.filters.invoiceNo, 'v-invoiceNo')
})
