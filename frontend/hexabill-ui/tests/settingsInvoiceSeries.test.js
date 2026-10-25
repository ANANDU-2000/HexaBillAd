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

// UX-005B: number of digits (INVOICE_NUMBER_WIDTH), auto-width and preview.
test('UX-005B: validateInvoiceNumberWidth accepts 4-9 and rejects -0, +5, decimals, out of range', async () => {
  const { validateInvoiceNumberWidth } = await import('../src/features/settings/settingsUpdatePayload.js')
  for (const v of ['4', '5', ' 9 ', 7, '']) assert.equal(validateInvoiceNumberWidth(v), true, `value ${JSON.stringify(v)}`)
  for (const v of ['-0', '+5', '5.0', '1.5', '3', '10', '11', '0', 'abc', '-5']) assert.equal(typeof validateInvoiceNumberWidth(v), 'string', `value ${v}`)
})

test('UX-005B: typing a start with leading zeros raises the digits to its length', async () => {
  const { autoWidthForStart } = await import('../src/features/settings/settingsUpdatePayload.js')
  assert.equal(autoWidthForStart('00000', '4'), '5')
  assert.equal(autoWidthForStart('000000', '5'), '6')
  assert.equal(autoWidthForStart('00000', '6'), null)
  assert.equal(autoWidthForStart('0000', '4'), null)
  assert.equal(autoWidthForStart('7000', '4'), null)
  assert.equal(autoWidthForStart('0', '4'), null)
  assert.equal(autoWidthForStart('000000000000', '4'), '9')
  assert.equal(autoWidthForStart('00000', ''), '5')
})

test('UX-005B: preview is the start zero-padded to the width', async () => {
  const { previewFirstInvoice } = await import('../src/features/settings/settingsUpdatePayload.js')
  assert.equal(previewFirstInvoice('00000', '5'), '00000')
  assert.equal(previewFirstInvoice('0', '5'), '00000')
  assert.equal(previewFirstInvoice('7000', '4'), '7000')
  assert.equal(previewFirstInvoice('12', '4'), '0012')
  assert.equal(previewFirstInvoice('00000', ''), '0000')
  assert.equal(previewFirstInvoice('', '5'), null)
  assert.equal(previewFirstInvoice('-1', '5'), null)
})

test('UX-005B: width is saved before the start, and only when changed', async () => {
  const { addInvoiceSeriesStartForUpdate, addInvoiceNumberWidthForUpdate } = await import('../src/features/settings/settingsUpdatePayload.js')
  const data = { invoiceSeriesStart: '00000', invoiceNumberWidth: '5' }
  const init = { invoiceSeriesStart: '', invoiceNumberWidth: '4' }
  const p = addInvoiceNumberWidthForUpdate(addInvoiceSeriesStartForUpdate({ A: '1' }, data, init), data, init)
  assert.deepEqual(Object.keys(p), ['A', 'INVOICE_NUMBER_WIDTH', 'INVOICE_SERIES_START'])
  assert.equal(p.INVOICE_SERIES_START, '00000')
  assert.equal(p.INVOICE_NUMBER_WIDTH, '5')
  const same = addInvoiceNumberWidthForUpdate({}, { invoiceNumberWidth: '4' }, { invoiceNumberWidth: '4' })
  assert.equal(Object.hasOwn(same, 'INVOICE_NUMBER_WIDTH'), false)
})

test('UX-005B: Settings page has the digits field next to the start, with preview and 44px targets', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync(new URL('../src/features/settings/SettingsPage.jsx', import.meta.url), 'utf8')
  assert.match(page, /label="Number of digits"/)
  assert.match(page, /validate: validateInvoiceNumberWidth/)
  assert.match(page, /First invoice:/)
  assert.match(page, /min-h-\[44px\] text-base/)
  assert.match(page, /addInvoiceNumberWidthForUpdate\(backendSettings/)
})
