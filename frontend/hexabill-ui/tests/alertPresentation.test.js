import test from 'node:test'
import assert from 'node:assert/strict'
import { describeAlert, alertAction, alertCategory, countByCategory, filterByCategory, alertTypeLabel, ALERT_CATEGORIES } from '../src/components/alertPresentation.js'

const dbMismatch = { type: 'DBMismatch', title: 'Stock mismatch detected for 3 products', message: 'Product IDs: 12, 15, 19' }

test('stock mismatch reads as a recount request and hides the id list by default', () => {
  const v = describeAlert(dbMismatch, { canSeeDetails: false })
  assert.equal(v.title, 'Stock needs a recount for 3 products')
  assert.equal(v.message, '')
  assert.equal(v.details, '')
  assert.doesNotMatch(JSON.stringify(v), /12, 15|Product IDs/)
})

test('owner/admin get the raw ids only behind details', () => {
  const v = describeAlert(dbMismatch, { canSeeDetails: true })
  assert.equal(v.message, '')
  assert.equal(v.details, 'Product IDs: 12, 15, 19')
})

test('singular, and a title without a count, stay readable', () => {
  assert.equal(describeAlert({ ...dbMismatch, title: 'Stock mismatch detected for 1 products' }).title, 'Stock needs a recount for 1 product')
  assert.equal(describeAlert({ type: 'DBMismatch', title: 'something odd', message: 'x' }).title, 'Stock needs a recount')
})

test('any alert whose message is only an id list is treated as detail', () => {
  const v = describeAlert({ type: 'Other', title: 'Check these', message: 'Customer IDs: 4, 9' })
  assert.equal(v.message, '')
  assert.equal(v.details, '')
  assert.equal(describeAlert({ type: 'Other', title: 'Check these', message: 'Customer IDs: 4, 9' }, { canSeeDetails: true }).details, 'Customer IDs: 4, 9')
})

test('ordinary alerts keep their server text', () => {
  const v = describeAlert({ type: 'LowStock', title: 'Low stock: Rice 5kg', message: '3 left, reorder level 10' })
  assert.deepEqual(v, { title: 'Low stock: Rice 5kg', message: '3 left, reorder level 10', details: '' })
})

test('"System" is now "Other" and the categories partition the alerts', () => {
  assert.deepEqual(ALERT_CATEGORIES.map((c) => c.label), ['All', 'Stock', 'Overdue', 'Other'])
  const alerts = [{ type: 'LowStock' }, { type: 'ProductExpiring' }, { type: 'OverdueInvoice' }, { type: 'DBMismatch' }, { type: 'BackupFailed' }]
  assert.deepEqual(countByCategory(alerts), { all: 5, stock: 2, overdue: 1, other: 2 })
  assert.equal(alertCategory('BalanceMismatch'), 'other')
})

test('category chips actually filter the list', () => {
  const alerts = [{ id: 1, type: 'LowStock' }, { id: 2, type: 'OverdueInvoice' }, { id: 3, type: 'DBMismatch' }]
  assert.deepEqual(filterByCategory(alerts, 'stock').map((a) => a.id), [1])
  assert.deepEqual(filterByCategory(alerts, 'overdue').map((a) => a.id), [2])
  assert.deepEqual(filterByCategory(alerts, 'other').map((a) => a.id), [3])
  assert.equal(filterByCategory(alerts, 'all').length, 3)
})

test('mismatch alerts offer one Review action; type badges are plain words', () => {
  assert.deepEqual(alertAction({ type: 'DBMismatch' }), { label: 'Review', path: '/products' })
  assert.deepEqual(alertAction({ type: 'BalanceMismatch' }), { label: 'Review', path: '/ledger' })
  assert.equal(alertAction({ type: 'Unknown' }), null)
  assert.equal(alertTypeLabel('DBMismatch'), 'Stock check')
  assert.equal(alertTypeLabel('SomeNewKind'), 'Some New Kind')
})
