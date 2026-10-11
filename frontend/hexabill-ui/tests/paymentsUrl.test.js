import test from 'node:test'
import assert from 'node:assert/strict'
import {
  syncPaymentsSearchParams,
  readPaymentsStateFromParams,
  buildPaymentsHref,
  paymentListParams,
  paymentDateRangeError
} from '../src/utils/paymentsUrl.js'

test('payments URL sync and read', () => {
  const params = new URLSearchParams()
  syncPaymentsSearchParams(params, {
    search: 'inv',
    method: 'Cash',
    status: 'Cleared',
    customerId: '42'
  })
  const parsed = readPaymentsStateFromParams(params)
  assert.equal(parsed.search, 'inv')
  assert.equal(parsed.method, 'Cash')
  assert.equal(parsed.customerId, '42')
})

test('buildPaymentsHref encodes customer deep link', () => {
  assert.equal(buildPaymentsHref({ customerId: 12 }), '/payments?customerId=12')
})

test('payment dates and pagination survive refresh while unrelated navigation state is preserved', () => {
  const params = new URLSearchParams('returnTo=ledger&customerId=42')
  syncPaymentsSearchParams(params, { fromDate: '2024-01-01', toDate: '2024-01-02', page: 3, customerId: '42' })
  const state = readPaymentsStateFromParams(params)
  assert.equal(state.fromDate, '2024-01-01')
  assert.equal(state.toDate, '2024-01-02')
  assert.equal(state.page, 3)
  assert.equal(state.customerId, '42')
  assert.equal(params.get('returnTo'), 'ledger')
  assert.equal(buildPaymentsHref(state), '/payments?customerId=42&fromDate=2024-01-01&toDate=2024-01-02&page=3')
})

test('payment query applies every filter on the server instead of searching the first hundred records', () => {
  assert.deepEqual(paymentListParams({ page: 2, search: ' INV-42 ', method: 'Cheque', status: 'pending', fromDate: '2024-01-01', toDate: '2024-01-02' }),
    { page: 2, pageSize: 25, search: 'INV-42', method: 'Cheque', status: 'pending', fromDate: '2024-01-01', toDate: '2024-01-02' })
})

test('invalid URL dates/pages do not become a different calendar date or an unbounded page', () => {
  const state = readPaymentsStateFromParams(new URLSearchParams('fromDate=2024-02-30&toDate=not-a-date&page=1e99'))
  assert.equal(state.fromDate, '')
  assert.equal(state.toDate, '')
  assert.equal(state.page, 1)
  assert.equal(paymentDateRangeError({ fromDate: '2024-01-03', toDate: '2024-01-01' }), 'From date must be on or before To date.')
  assert.equal(paymentDateRangeError({ fromDate: '2024-01-01', toDate: '2024-01-01' }), '')
})

test('clearing filters also clears range and page without deleting unrelated parameters', () => {
  const params = new URLSearchParams('fromDate=2024-01-01&toDate=2024-01-02&page=3&returnTo=ledger')
  syncPaymentsSearchParams(params, {})
  assert.equal(params.toString(), 'returnTo=ledger')
})
