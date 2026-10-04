import test from 'node:test'
import assert from 'node:assert/strict'
import {
  syncPaymentsSearchParams,
  readPaymentsStateFromParams,
  buildPaymentsHref
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
