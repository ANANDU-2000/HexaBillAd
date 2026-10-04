import test from 'node:test'
import assert from 'node:assert/strict'
import { getReturnLabel } from '../src/utils/returnNavigation.js'
import { buildCustomerLedgerHref } from '../src/utils/customerLedgerUrl.js'

test('getReturnLabel maps ledger and payments deep links', () => {
  assert.equal(getReturnLabel('/ledger?customerId=9&tab=payments'), 'Customer ledger')
  assert.equal(getReturnLabel('/payments'), 'Payments')
  assert.equal(getReturnLabel('/pos?editId=1'), 'POS')
})

test('Record Payment deep link preserves customer + payments tab + sale', () => {
  const href = buildCustomerLedgerHref({
    customerId: 12,
    tab: 'payments',
    recordPaymentSaleId: 404
  })
  assert.equal(href, '/ledger?customerId=12&recordPayment=404&tab=payments')
  // returnTo after payment should round-trip the same context path
  const returnTo = href
  assert.match(returnTo, /customerId=12/)
  assert.match(returnTo, /recordPayment=404|tab=payments/)
  assert.equal(getReturnLabel(returnTo), 'Customer ledger')
})
