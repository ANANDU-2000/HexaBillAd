import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInvoiceQuery, pickableInvoices, returnHrefForSale, PICKER_PAGE_SIZE } from '../src/features/returns/invoicePickerQuery.js'

const NOW = new Date(2026, 10, 8, 12, 0, 0) // 8 Nov 2026 local

test('empty search lists the last 30 days, newest page of 20', () => {
  const q = buildInvoiceQuery('', NOW)
  assert.equal(q.fromDate, '2026-10-09')
  assert.equal(q.toDate, '2026-11-08')
  assert.equal(q.pageSize, PICKER_PAGE_SIZE)
  assert.equal(q.search, undefined)
})

test('typed search covers every date and carries the trimmed text', () => {
  const q = buildInvoiceQuery('  INV-77 ', NOW)
  assert.equal(q.search, 'INV-77')
  assert.equal(q.fromDate, undefined)
  assert.equal(q.toDate, undefined)
})

test('one character is too short to search, so the recent list stays', () => {
  const q = buildInvoiceQuery('a', NOW)
  assert.equal(q.search, undefined)
  assert.ok(q.fromDate)
})

test('legacy imported invoices and rows without an id are not offered', () => {
  const rows = pickableInvoices([{ id: 1, invoiceNo: 'A' }, { id: 2, isLegacy: true }, { invoiceNo: 'no id' }, null])
  assert.deepEqual(rows.map((r) => r.id), [1])
  assert.deepEqual(pickableInvoices(undefined), [])
})

test('the picker opens the existing return flow for the chosen invoice', () => {
  assert.equal(returnHrefForSale(42), '/returns/create?saleId=42')
})
