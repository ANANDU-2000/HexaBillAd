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

// UX-005: series start 0 (P0-NUM-001) is valid and saved as the string '0'.
test('UX-005: entering 0 passes validation and is sent as INVOICE_SERIES_START "0"', async () => {
  const { validateInvoiceSeriesStart } = await import('../src/features/settings/settingsUpdatePayload.js')
  for (const v of ['0', ' 0 ', 0, '00000']) assert.equal(validateInvoiceSeriesStart(v), true, `value ${JSON.stringify(v)}`)
  for (const v of ['-1', '1.5', 'abc']) assert.equal(typeof validateInvoiceSeriesStart(v), 'string', `value ${v}`)
  assert.equal(validateInvoiceSeriesStart(''), true)
  assert.deepEqual(addInvoiceSeriesStartForUpdate({}, { invoiceSeriesStart: '0' }, { invoiceSeriesStart: '' }), { INVOICE_SERIES_START: '0' })
  assert.deepEqual(addInvoiceSeriesStartForUpdate({}, { invoiceSeriesStart: 0 }, { invoiceSeriesStart: '7000' }), { INVOICE_SERIES_START: '0' })
})

test('UX-005: the Settings field allows 0 and uses the shared validator', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync(new URL('../src/features/settings/SettingsPage.jsx', import.meta.url), 'utf8')
  const field = page.slice(page.indexOf('label="New invoice numbers start at"'), page.indexOf("register('invoiceSeriesStart'") + 200)
  assert.match(field, /min="0"/)
  assert.match(field, /validate: validateInvoiceSeriesStart/)
})
