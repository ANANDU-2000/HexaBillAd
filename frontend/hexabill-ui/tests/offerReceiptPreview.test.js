import test from 'node:test'
import assert from 'node:assert/strict'
import {
  receiptOfferBlockedMessage,
  resolveReceiptOfferPaymentId
} from '../src/utils/offerReceiptPreview.js'

const clearedCash = { id: 42, status: 'CLEARED', amount: 100, mode: 'CASH' }

test('resolveReceiptOfferPaymentId accepts cleared cash payment', () => {
  assert.equal(resolveReceiptOfferPaymentId(clearedCash), 42)
})

test('resolveReceiptOfferPaymentId rejects settlement adjustment', () => {
  assert.equal(
    resolveReceiptOfferPaymentId({ ...clearedCash, isSettlementAdjustment: true }),
    null
  )
})

test('resolveReceiptOfferPaymentId rejects pending and invalid ids', () => {
  assert.equal(resolveReceiptOfferPaymentId({ ...clearedCash, status: 'PENDING' }), null)
  assert.equal(resolveReceiptOfferPaymentId({ ...clearedCash, id: 0 }), null)
})

test('receiptOfferBlockedMessage explains ineligible payments', () => {
  assert.equal(receiptOfferBlockedMessage(clearedCash), null)
  assert.match(
    receiptOfferBlockedMessage({ ...clearedCash, isSettlementAdjustment: true }),
    /settlement adjustment/i
  )
})
