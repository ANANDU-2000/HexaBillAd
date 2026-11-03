import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_DATES_FROM,
  billingDateWindow,
  canonicalOutstandingBalance,
  historicalCollectionId,
  localDateKey,
  mergeCustomerBillRows,
  salePdfId,
} from '../src/utils/customerBillRows.js'
import { invoiceBillTotals } from '../src/utils/invoiceBillTotals.js'

// Customer 139 (FrozenHub 1) as it exists in production: one current sale and three pending historical invoices
// that the old page showed twice (once from the sales report merge, once from the legacy list).
const currentSale = { id: 7013, invoiceNo: '7013', customerId: 139, grandTotal: 1475, paidAmount: 0, invoiceDate: '2026-11-02', isLegacy: false }
const legacyPending = [
  { id: 1353, legacyInvoiceId: 1352, invoiceNo: '6955', customerId: 139, grandTotal: 1485, paidAmount: 0, invoiceDate: '2026-10-30', isLegacy: true },
  { id: 1354, legacyInvoiceId: 1353, invoiceNo: '6974', customerId: 139, grandTotal: 1465, paidAmount: 0, invoiceDate: '2026-10-31', isLegacy: true },
  { id: 1355, legacyInvoiceId: 1354, invoiceNo: '6995', customerId: 139, grandTotal: 1455, paidAmount: 0, invoiceDate: '2026-10-31', isLegacy: true },
]
const outstandingFromBackend = [
  { id: 7013, customerId: 139, invoiceNo: '7013', balanceAmount: 1475 },
  { id: -1352, customerId: 139, invoiceNo: '6955', balanceAmount: 1485 },
  { id: -1353, customerId: 139, invoiceNo: '6974', balanceAmount: 1465 },
  { id: -1354, customerId: 139, invoiceNo: '6995', balanceAmount: 1455 },
]

test('billingDateWindow sends explicit bounds for both sources when the range is empty', () => {
  const window = billingDateWindow({ from: '', to: '' }, new Date(2026, 10, 3, 9, 30))
  assert.deepEqual(window, { fromDate: ALL_DATES_FROM, toDate: '2026-11-03' })
})

test('billingDateWindow passes an explicit range through unchanged', () => {
  assert.deepEqual(
    billingDateWindow({ from: '2026-10-01', to: '2026-10-31' }, new Date(2026, 10, 3)),
    { fromDate: '2026-10-01', toDate: '2026-10-31' },
  )
})

test('localDateKey formats single-digit months and days with leading zeros', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05')
})

test('a historical invoice that arrives from both sources appears exactly once', () => {
  const operatingWithDuplicate = [currentSale, { ...legacyPending[2], isLegacy: true, id: -1354 }]
  const { rows, duplicatesDropped, historicalRowsInOperatingSource } = mergeCustomerBillRows(operatingWithDuplicate, legacyPending)
  assert.equal(rows.filter((r) => r.invoiceNo === '6995').length, 1)
  assert.equal(historicalRowsInOperatingSource, 1)
  assert.equal(duplicatesDropped, 0)
  assert.equal(rows.length, 4)
})

test('a repeated historical record from the legacy list is counted as dropped, not shown twice', () => {
  const { rows, duplicatesDropped } = mergeCustomerBillRows([currentSale], [legacyPending[0], legacyPending[0]])
  assert.equal(rows.length, 2)
  assert.equal(duplicatesDropped, 1)
})

test('same invoice number for different customers stays as two distinct records', () => {
  const otherCustomer = { id: 9001, legacyInvoiceId: 9001, invoiceNo: '6995', customerId: 143, grandTotal: 432, paidAmount: 0, isLegacy: true }
  const { rows } = mergeCustomerBillRows([], [legacyPending[2], otherCustomer])
  assert.equal(rows.length, 2)
})

test('a current invoice with the same number as a historical one is not treated as a duplicate', () => {
  const currentSameNumber = { id: 5555, invoiceNo: '6995', customerId: 139, grandTotal: 100, paidAmount: 0, isLegacy: false }
  const { rows } = mergeCustomerBillRows([currentSameNumber], [legacyPending[2]])
  assert.equal(rows.length, 2)
})

test('footer pending equals the unique outstanding amount, not a double-counted sum', () => {
  const { rows } = mergeCustomerBillRows([currentSale], legacyPending)
  const totals = invoiceBillTotals(rows)
  assert.equal(totals.totalInvoices, 4)
  assert.equal(totals.totalPending, 5880)
  assert.equal(totals.totalPaid, 0)
})

test('header balance is the canonical outstanding across history, not the cached 1,475', () => {
  assert.equal(canonicalOutstandingBalance(outstandingFromBackend), 5880)
  assert.equal(canonicalOutstandingBalance([]), 0)
})

test('canonical outstanding ignores negative or missing balances', () => {
  assert.equal(canonicalOutstandingBalance([{ balanceAmount: -50 }, { balanceAmount: 20.5 }, {}]), 20.5)
})

test('historical collection targets the negative legacy id only while money is still owed', () => {
  const pending = { isLegacy: true, legacyInvoiceId: 1354, customerId: 139, outstandingBalance: 1455, isDeleted: false }
  assert.equal(historicalCollectionId(pending), -1354)
  assert.equal(historicalCollectionId({ ...pending, outstandingBalance: 0 }), undefined)
  assert.equal(historicalCollectionId({ ...pending, isDeleted: true }), undefined)
  assert.equal(historicalCollectionId({ ...pending, customerId: null }), undefined) // orphan stays unassigned
  assert.equal(historicalCollectionId({ ...pending, legacyInvoiceId: null }), undefined)
  assert.equal(historicalCollectionId({ ...pending, isLegacy: false }), undefined) // operating rows use their sale id
})

test('a historical row never resolves to a live sale PDF, even when its legacy id equals a live sale id', () => {
  // Legacy 1618 (invoice 6338) collides with live sale 1618 (FH-SMK-1791254849) in tenant 20.
  const historical = { isLegacy: true, id: 1618, legacyInvoiceId: 1618, invoiceNo: '6338', customerId: 141 }
  assert.equal(salePdfId(historical), undefined)
  assert.equal(salePdfId({ isLegacy: true, id: -1618 }), undefined)
})

test('a live sale row resolves to its own sale id for PDF', () => {
  assert.equal(salePdfId({ isLegacy: false, id: 1618, invoiceNo: 'FH-SMK-1791254849' }), 1618)
  assert.equal(salePdfId({ id: 1606 }), 1606)
  assert.equal(salePdfId({ id: 0 }), undefined)
  assert.equal(salePdfId(null), undefined)
})
