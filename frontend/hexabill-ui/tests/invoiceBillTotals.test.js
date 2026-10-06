import test from 'node:test'
import assert from 'node:assert/strict'
import { invoiceBillTotals } from '../src/utils/invoiceBillTotals.js'

test('partially settled synthetic bills reconcile to 100 paid and 105 pending', () => {
  assert.deepEqual(invoiceBillTotals([
    { grandTotal: 105, paidAmount: 100, paymentStatus: 'Partial' },
    { grandTotal: 40, paidAmount: 0, paymentStatus: 'Pending' },
    { grandTotal: 60, paidAmount: 0, paymentStatus: 'Pending' },
  ]), { totalInvoices: 3, totalPaid: 100, totalPending: 105 })
})

test('a status label cannot replace the recorded paid amount with the invoice face value', () => {
  assert.deepEqual(invoiceBillTotals([{ grandTotal: 50, paidAmount: 23, paymentStatus: 'Paid' }]),
    { totalInvoices: 1, totalPaid: 23, totalPending: 27 })
})

test('paid amounts remain counted when a status is absent or uses different casing', () => {
  assert.deepEqual(invoiceBillTotals([
    { grandTotal: 20, paidAmount: 15 },
    { grandTotal: 5, paidAmount: 5, paymentStatus: 'PAID' },
  ]), { totalInvoices: 2, totalPaid: 20, totalPending: 5 })
})

test('numeric string amounts sum as money rather than concatenate', () => {
  assert.deepEqual(invoiceBillTotals([
    { grandTotal: '20.25', paidAmount: '10.25', paymentStatus: 'Partial' },
    { grandTotal: '5.75', paidAmount: '5.75', paymentStatus: 'Paid' },
  ]), { totalInvoices: 2, totalPaid: 16, totalPending: 10 })
})

test('an empty date-filtered list has zero totals', () => {
  assert.deepEqual(invoiceBillTotals([]), { totalInvoices: 0, totalPaid: 0, totalPending: 0 })
})

test('totals belong to the supplied filtered rows, without another invoice list', () => {
  const invoices = [{ id: 1, grandTotal: 105, paidAmount: 100 }, { id: 2, grandTotal: 40, paidAmount: null }]
  assert.deepEqual(invoiceBillTotals(invoices.filter(invoice => invoice.id === 2)),
    { totalInvoices: 1, totalPaid: 0, totalPending: 40 })
})

test('cent totals avoid summation noise and overpayment does not reduce another bill due', () => {
  assert.deepEqual(invoiceBillTotals([
    { grandTotal: 0.1, paidAmount: 0.1 }, { grandTotal: 0.2, paidAmount: 0.2 },
    { grandTotal: 10, paidAmount: 15 }, { grandTotal: 5, paidAmount: 0 },
  ]), { totalInvoices: 4, totalPaid: 15.3, totalPending: 5 })
})
