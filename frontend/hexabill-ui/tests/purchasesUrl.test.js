import test from 'node:test'
import assert from 'node:assert/strict'
import { syncPurchasesSearchParams, readPurchasesStateFromParams } from '../src/utils/purchasesUrl.js'

test('purchases URL sync omits defaults and round-trips', () => {
  const params = new URLSearchParams('status=Paid&page=9')
  syncPurchasesSearchParams(params, {
    statusFilter: 'all',
    filterPeriod: 'month',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    supplierSearch: 'Acme',
    categoryFilter: '',
    currentPage: 2
  })
  assert.equal(params.get('period'), 'month')
  assert.equal(params.get('supplier'), 'Acme')
  assert.equal(params.get('page'), '2')
  assert.equal(params.has('status'), false)
  const parsed = readPurchasesStateFromParams(params)
  assert.equal(parsed.currentPage, 2)
  assert.equal(parsed.supplierSearch, 'Acme')
  assert.equal(parsed.filterPeriod, 'month')
})
