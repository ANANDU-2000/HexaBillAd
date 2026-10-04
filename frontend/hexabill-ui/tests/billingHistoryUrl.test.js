import test from 'node:test'
import assert from 'node:assert/strict'
import { syncBillingHistorySearchParams } from '../src/utils/billingHistoryUrl.js'

test('syncBillingHistorySearchParams writes filters and omits defaults', () => {
  const params = new URLSearchParams('page=2&search=old')
  syncBillingHistorySearchParams(params, { search: 'inv-1', page: 3, from: '2026-01-01', to: '' })
  assert.equal(params.get('search'), 'inv-1')
  assert.equal(params.get('page'), '3')
  assert.equal(params.get('from'), '2026-01-01')
  assert.equal(params.has('to'), false)
  syncBillingHistorySearchParams(params, { search: '', page: 1, from: '', to: '' })
  assert.equal(params.has('search'), false)
  assert.equal(params.has('page'), false)
})
