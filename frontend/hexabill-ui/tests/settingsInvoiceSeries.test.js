import test from 'node:test'
import assert from 'node:assert/strict'
import { addInvoiceSeriesStartForUpdate } from '../src/features/settings/settingsUpdatePayload.js'

test('invoice numbering start is sent when the owner sets it', () => {
  const payload = addInvoiceSeriesStartForUpdate({}, { invoiceSeriesStart: ' 7000 ' }, { invoiceSeriesStart: '' })
  assert.equal(payload.INVOICE_SERIES_START, '7000')
})

test('saving unrelated settings leaves the invoice numbering start alone', () => {
  const payload = addInvoiceSeriesStartForUpdate({ COMPANY_NAME_EN: 'X' }, { invoiceSeriesStart: '7000' }, { invoiceSeriesStart: '7000' })
  assert.equal(Object.hasOwn(payload, 'INVOICE_SERIES_START'), false)
  const untouched = addInvoiceSeriesStartForUpdate({}, { invoiceSeriesStart: '' }, { invoiceSeriesStart: '' })
  assert.equal(Object.hasOwn(untouched, 'INVOICE_SERIES_START'), false)
})

test('clearing the start is sent so the server can refuse it once invoices were issued', () => {
  const payload = addInvoiceSeriesStartForUpdate({}, { invoiceSeriesStart: '' }, { invoiceSeriesStart: '7000' })
  assert.equal(payload.INVOICE_SERIES_START, '')
})
