import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCustomerLedgerCollectHref,
  buildCustomerLedgerHref,
  normalizeLedgerTab,
  syncLedgerTabSearchParam
} from '../src/utils/customerLedgerUrl.js'

test('normalizeLedgerTab accepts known tabs and defaults to ledger', () => {
  assert.equal(normalizeLedgerTab('payments'), 'payments')
  assert.equal(normalizeLedgerTab('bogus'), 'ledger')
  assert.equal(normalizeLedgerTab(null), 'ledger')
})

test('syncLedgerTabSearchParam omits default ledger tab', () => {
  const params = new URLSearchParams('tab=payments')
  syncLedgerTabSearchParam(params, { tab: 'ledger' })
  assert.equal(params.has('tab'), false)
  syncLedgerTabSearchParam(params, { tab: 'invoices' })
  assert.equal(params.get('tab'), 'invoices')
})

test('buildCustomerLedgerHref deep-links customer, tab and recordPayment sale', () => {
  const href = buildCustomerLedgerHref({
    customerId: 42,
    tab: 'payments',
    recordPaymentSaleId: 9001
  })
  assert.equal(href, '/ledger?customerId=42&recordPayment=9001&tab=payments')
})

test('buildCustomerLedgerHref omits empty optional fields', () => {
  assert.equal(buildCustomerLedgerHref(), '/ledger')
  assert.equal(buildCustomerLedgerHref({ customerId: 5 }), '/ledger?customerId=5')
})

test('buildCustomerLedgerHref openPayment deep link', () => {
  assert.equal(
    buildCustomerLedgerHref({ customerId: 7, tab: 'payments', openPayment: true }),
    '/ledger?customerId=7&openPayment=1&tab=payments'
  )
  assert.equal(
    buildCustomerLedgerHref({ customerId: 7, recordPaymentSaleId: 3, openPayment: true }),
    '/ledger?customerId=7&recordPayment=3'
  )
})

test('buildCustomerLedgerCollectHref opens payment tab when sale has balance', () => {
  assert.equal(
    buildCustomerLedgerCollectHref({ customerId: 1, saleId: 99, balanceAmount: 50 }),
    '/ledger?customerId=1&recordPayment=99&tab=payments'
  )
  assert.equal(
    buildCustomerLedgerCollectHref({ customerId: 1, saleId: 99, balanceAmount: 0 }),
    '/ledger?customerId=1'
  )
})
