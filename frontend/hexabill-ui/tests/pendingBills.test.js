import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPendingRows, overdueLabel, receivePaymentPath, totalOutstanding } from '../src/utils/pendingBills.js'

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
