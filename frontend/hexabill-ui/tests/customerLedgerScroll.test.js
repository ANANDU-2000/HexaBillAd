import test from 'node:test'
import assert from 'node:assert/strict'
import { customerLedgerScrollKey, readCustomerLedgerScroll, writeCustomerLedgerScroll } from '../src/utils/customerLedgerScroll.js'

test('customerLedgerScrollKey scopes tenant, user, customer and tab', () => {
  const key = customerLedgerScrollKey({ tenantId: 3, userId: 9, customerId: 42, tab: 'payments' })
  assert.equal(key, 'hexabill.ledgerScroll.3.9.42.payments')
})

test('write and read scroll position in sessionStorage', () => {
  if (typeof sessionStorage === 'undefined') {
    assert.equal(readCustomerLedgerScroll('missing'), 0)
    return
  }
  const key = 'hexabill.ledgerScroll.test'
  writeCustomerLedgerScroll(key, 128.7)
  assert.equal(readCustomerLedgerScroll(key), 129)
  sessionStorage.removeItem(key)
})
