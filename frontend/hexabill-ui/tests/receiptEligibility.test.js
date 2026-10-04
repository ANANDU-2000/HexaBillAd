import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canReceivePaymentReceipt,
  currentReceiptSelection,
  normalizePaymentForReceipt,
  paymentFromCustomerLedgerEntry,
  receiptIneligibilityReason
} from '../src/utils/receiptEligibility.js'

const payment = { id: 1, status: 'CLEARED', mode: 'CASH', amount: 1330 }
test('receipt selection accepts cleared incoming funds and rejects other entries', () => {
  assert.equal(canReceivePaymentReceipt(payment), true)
  for (const changes of [{ status: 'PENDING' }, { status: 'VOID' }, { status: 'RETURNED' },
    { status: undefined }, { amount: 0 }, { amount: -1 }, { amount: 'bad' },
    { mode: 'CREDIT' }, { mode: 'unknown' }, { saleReturnId: 5 }, { isRefund: true }, { id: null },
    { isSettlementAdjustment: true }]) {
    assert.equal(canReceivePaymentReceipt({ ...payment, ...changes }), false)
  }
  assert.equal(canReceivePaymentReceipt({ ...payment, mode: 'CHEQUE' }), true)
})
test('normalizePaymentForReceipt accepts PascalCase API rows', () => {
  assert.deepEqual(
    normalizePaymentForReceipt({ Id: 9, Status: 'CLEARED', Mode: 'CASH', Amount: 50 }),
    { id: 9, status: 'CLEARED', mode: 'CASH', amount: 50, saleReturnId: null, isRefund: false, isSettlementAdjustment: false }
  )
  assert.equal(canReceivePaymentReceipt({ Id: 9, Status: 'CLEARED', Mode: 'CASH', Amount: 50 }), true)
})

test('paymentFromCustomerLedgerEntry blocks settlement adjustment rows', () => {
  const row = {
    type: 'Payment',
    paymentId: 9,
    credit: 1,
    paymentMode: 'CASH',
    paymentLineStatus: 'CLEARED',
    isSettlementAdjustment: true
  }
  const payment = paymentFromCustomerLedgerEntry(row)
  assert.equal(canReceivePaymentReceipt(payment), false)
  assert.match(receiptIneligibilityReason(payment), /settlement adjustment/i)
})

test('receiptIneligibilityReason explains settlement adjustments', () => {
  assert.match(
    receiptIneligibilityReason({ ...payment, isSettlementAdjustment: true }),
    /settlement adjustment/i
  )
})

test('selection drops old customer IDs and payments that become ineligible before submission', () => {
  const current = [payment, { ...payment, id: 2, status: 'VOID' }, { ...payment, id: 3 }]
  assert.deepEqual(currentReceiptSelection(current, [1, 1, 2, 99]), [1])
  assert.deepEqual(currentReceiptSelection([{ ...payment, id: 10 }], [1, 3]), [])
})
