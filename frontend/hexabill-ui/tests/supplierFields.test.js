import test from 'node:test'
import assert from 'node:assert/strict'
import { fixEmail, fixPhone, fixSupplierForm } from '../src/utils/supplierFields.js'

test('email is tidied and unusable email is dropped with a note', () => {
  assert.equal(fixEmail(' Sales@Supplier.COM ').value, 'sales@supplier.com')
  assert.equal(fixEmail('a b@x.con').value, 'ab@x.com')
  assert.equal(fixEmail('not-an-email').value, '')
  assert.match(fixEmail('not-an-email').note, /left empty/)
  assert.equal(fixEmail('').note, '')
})

test('phone keeps digits and plus, drops letters, rejects too short', () => {
  assert.equal(fixPhone('+971  50 123 4567 ext').value, '+971 50 123 4567')
  assert.equal(fixPhone('12').value, '')
})

test('form: name is required, credit is repaired, spaces collapse', () => {
  assert.match(fixSupplierForm({ name: '   ' }).error, /supplier name/)
  const r = fixSupplierForm({ name: '  Gulf   Frozen ', creditLimit: '-5', email: '', phone: '', address: ' Dubai  ', paymentTerms: 'Net 30' })
  assert.equal(r.error, '')
  assert.equal(r.values.name, 'Gulf Frozen')
  assert.equal(r.values.creditLimit, 0)
  assert.equal(r.values.address, 'Dubai')
  assert.equal(r.values.email, undefined)
  assert.ok(r.notes.length >= 2)
})

test('empty credit stays empty (no limit)', () => {
  assert.equal(fixSupplierForm({ name: 'A', creditLimit: '' }).values.creditLimit, undefined)
})
