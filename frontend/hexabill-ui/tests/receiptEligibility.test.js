import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canReceivePaymentReceipt,
  currentReceiptSelection,
  normalizePaymentForReceipt,
  paymentFromCustomerLedgerEntry,
  receiptIneligibilityReason,
  paymentStatusLabel, receiptSelectionSummary, toggleVisibleReceiptSelection
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

test('ledger display label never overrides authoritative receipt state or adjustment flag', () => {
  const row = {type:'Payment',paymentId:9,realGotPayment:50,paymentMode:'CASH',status:'Paid',paymentLineStatus:'CLEARED'}
  assert.equal(canReceivePaymentReceipt(paymentFromCustomerLedgerEntry(row)),true)
  assert.equal(canReceivePaymentReceipt(paymentFromCustomerLedgerEntry({...row,paymentLineStatus:'PENDING'})),false)
  assert.equal(canReceivePaymentReceipt(paymentFromCustomerLedgerEntry({...row,isSettlementAdjustment:true})),false)
  assert.equal(canReceivePaymentReceipt(paymentFromCustomerLedgerEntry({...row,paymentLineStatus:undefined})),false)
})

test('VOID and unknown cash states never display completed; pending credit remains pending',()=>{
  assert.equal(paymentStatusLabel({...payment,status:'VOID'}),'Voided')
  assert.equal(paymentStatusLabel({...payment,status:undefined}),'Unknown')
  assert.equal(paymentStatusLabel({...payment,status:'PENDING',mode:'CREDIT'}),'Pending')
  assert.equal(paymentStatusLabel({...payment,status:'RETURNED',mode:'CHEQUE'}),'Returned')
})

test('filtered receipt selection keeps hidden amounts and tests visible membership rather than counts',()=>{
  const all=[{...payment,amount:'50',customerId:1},{...payment,id:2,amount:30,customerId:1},{...payment,id:3,amount:99,customerId:2}]
  const selected=receiptSelectionSummary(all,[1,2],[all[1]])
  assert.equal(selected.total,80)
  assert.equal(selected.customerCount,1)
  assert.equal(selected.allVisibleSelected,true)
  assert.equal(receiptSelectionSummary(all,[1],[all[1]]).allVisibleSelected,false)
  assert.equal(receiptSelectionSummary(all,[1,3]).customerCount,2)
  assert.deepEqual(toggleVisibleReceiptSelection([1],[2]),[1,2])
  assert.deepEqual(toggleVisibleReceiptSelection([1,2],[2]),[1])
})
