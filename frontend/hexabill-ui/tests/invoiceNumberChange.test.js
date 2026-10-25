import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canChangeInvoiceNumber, isRenumberableSale, sanitizeInvoiceNumberInput,
  validateInvoiceNumberChange, mapInvoiceNumberError,
} from '../src/utils/invoiceNumberChange.js'

test('only Owner and Admin may change numbers', () => {
  assert.equal(canChangeInvoiceNumber('Owner'), true)
  assert.equal(canChangeInvoiceNumber('admin'), true)
  assert.equal(canChangeInvoiceNumber('Staff'), false)
  assert.equal(canChangeInvoiceNumber(undefined), false)
})

test('deleted and imported rows are not offered the action', () => {
  assert.equal(isRenumberableSale({ id: 1, externalReference: null }), true)
  assert.equal(isRenumberableSale({ id: 1, externalReference: 'pos-abc' }), true)
  assert.equal(isRenumberableSale({ id: 1, isDeleted: true }), false)
  assert.equal(isRenumberableSale({ id: 1, externalReference: 'starplus:123' }), false)
  assert.equal(isRenumberableSale({ id: 1, ExternalReference: 'STARPLUS:9' }), false)
  assert.equal(isRenumberableSale(null), false)
})

test('input keeps digits and leading zeros as a string', () => {
  assert.equal(sanitizeInvoiceNumberInput('00 01-a2'), '00012')
  assert.equal(sanitizeInvoiceNumberInput('７000'), '000') // full-width digit dropped, ASCII only
  assert.equal(sanitizeInvoiceNumberInput(null), '')
})

test('client validation', () => {
  const ok = { current: '1791254852', next: '7000', reason: 'Renumber' }
  assert.equal(validateInvoiceNumberChange(ok), null)
  assert.equal(validateInvoiceNumberChange({ ...ok, next: '0000' }), null)
  assert.equal(validateInvoiceNumberChange({ ...ok, next: '' }).field, 'number')
  assert.match(validateInvoiceNumberChange({ ...ok, next: '700' }).message, /at least 4/)
  assert.match(validateInvoiceNumberChange({ ...ok, next: '70a0' }).message, /digits only/)
  assert.match(validateInvoiceNumberChange({ ...ok, next: '1791254852' }).message, /already the invoice number/)
  assert.equal(validateInvoiceNumberChange({ ...ok, reason: '  ' }).field, 'reason')
})

test('server errors map to inline messages without internal source names', () => {
  const imp = mapInvoiceNumberError(400, { message: 'Imported invoices keep their original number and cannot be renumbered.' })
  assert.doesNotMatch(imp.message, /import|starplus/i)
  assert.match(mapInvoiceNumberError(400, { message: 'Deleted invoices cannot be renumbered.' }).message, /Deleted/)
  assert.match(mapInvoiceNumberError(400, { message: 'Invoice number 7000 was already issued (including deleted or voided invoices) and cannot be used again.' }).message, /already been used/)
  assert.equal(mapInvoiceNumberError(400, { message: 'Numbers below 7000 are kept for earlier invoices. Use 7000 or higher.' }).message, 'The number must be 7000 or higher.')
  assert.match(mapInvoiceNumberError(400, { message: 'Invoice numbers use digits only, at least 4 (for example 7000).' }).message, /digits only/)
  assert.doesNotMatch(mapInvoiceNumberError(400, { message: 'starplus row' }).message, /starplus/i)
  assert.equal(mapInvoiceNumberError(409, {}).kind, 'conflict')
  assert.match(mapInvoiceNumberError(409, {}).message, /someone else.*Reload/)
  assert.equal(mapInvoiceNumberError(403, {}).kind, 'forbidden')
  assert.equal(mapInvoiceNumberError(404, {}).kind, 'notFound')
  assert.equal(mapInvoiceNumberError(undefined).kind, 'network')
  assert.equal(mapInvoiceNumberError(500, {}).kind, 'server')
})
