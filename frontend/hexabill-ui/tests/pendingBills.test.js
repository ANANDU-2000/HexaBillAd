import test from 'node:test'
import assert from 'node:assert/strict'
import { billKey, filterPendingRows, isLiveBill, overdueLabel, paySelectedPath, receivePaymentPath, selectedBillsTotal, totalOutstanding } from '../src/utils/pendingBills.js'

const rows = [
  { customerId: 1, customerName: 'KHAN DARBAR RESTAURANT', phone: '0501234567', trn: '100200300400500', totalOutstanding: 2169, overdueDays: 3 },
  { customerId: 2, customerName: 'STICK MAGIC RESTAURANT', phone: null, trn: null, totalOutstanding: 575, overdueDays: 0 },
]

test('search matches name, phone or TRN, case-insensitively; blank keeps everything', () => {
  assert.equal(filterPendingRows(rows, '').length, 2)
  assert.deepEqual(filterPendingRows(rows, 'khan').map((r) => r.customerId), [1])
  assert.deepEqual(filterPendingRows(rows, '0501234').map((r) => r.customerId), [1])
  assert.deepEqual(filterPendingRows(rows, '300400').map((r) => r.customerId), [1])
  assert.deepEqual(filterPendingRows(null, 'x'), [])
})

test('Receive Payment opens the ledger Payments tab (with the payment modal) for that customer; an invalid id falls back to the ledger', () => {
  const href = receivePaymentPath(1)
  assert.ok(href.startsWith('/ledger?customerId=1'), href)
  assert.match(href, /(^|&)tab=payments(?:&|$)/, 'opens the Payments tab')
  assert.match(href, /(^|&)openPayment=1(?:&|$)/, 'opens the payment entry directly')
  assert.equal(receivePaymentPath('abc'), '/ledger')
  assert.equal(receivePaymentPath(0), '/ledger')
})

test('overdue wording', () => {
  assert.equal(overdueLabel(0), 'Not yet due')
  assert.equal(overdueLabel(1), '1 day overdue')
  assert.equal(overdueLabel(3), '3 days overdue')
})

test('total is rounded to 2 decimals and ignores bad values', () => {
  assert.equal(totalOutstanding(rows), 2744)
  assert.equal(totalOutstanding([{ totalOutstanding: 0.1 }, { totalOutstanding: 0.2 }]), 0.3)
  assert.equal(totalOutstanding([{ totalOutstanding: 'x' }]), 0)
})

const bills = [
  { source: 'Live', saleId: 7001, invoiceNo: '7001', balanceDue: 100.1, grandTotal: 200, paidAmount: 99.9 },
  { source: 'Live', saleId: 7002, invoiceNo: '7002', balanceDue: 250.25 },
  { source: 'Historical', legacyInvoiceId: 9001, invoiceNo: 'H9001', balanceDue: 50.5 },
]

test('billKey is stable per live/legacy bill; isLiveBill only accepts live sale ids', () => {
  assert.equal(billKey(bills[0]), 'live-7001')
  assert.equal(billKey(bills[1]), 'live-7002')
  assert.equal(billKey(bills[2]), 'legacy-9001')
  assert.equal(isLiveBill(bills[0]), true)
  assert.equal(isLiveBill(bills[2]), false)
  assert.equal(isLiveBill({ source: 'Live', saleId: -5 }), false)
})

test('selectedBillsTotal sums only the selected bills, rounded to 2 decimals', () => {
  assert.equal(selectedBillsTotal(bills, new Set(['live-7001', 'legacy-9001'])), 150.6)
  assert.equal(selectedBillsTotal(bills, new Set(['none'])), 0)
  assert.equal(selectedBillsTotal(bills, new Set()), 0)
})

test('paySelectedPath deep-links a single live bill, otherwise the Payments tab; invalid ids fall back to the ledger', () => {
  const one = paySelectedPath(212, [bills[1]])
  assert.ok(one.includes('customerId=212'), one)
  assert.ok(one.includes('recordPayment=7002'), one)
  const many = paySelectedPath(212, [bills[0], bills[1]])
  assert.ok(many.includes('customerId=212') && many.includes('openPayment=1'), many)
  assert.ok(many.includes('tab=payments'), many)
  assert.equal(paySelectedPath('abc', [bills[0]]), '/ledger')
})
