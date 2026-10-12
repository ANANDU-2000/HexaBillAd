import test from 'node:test'
import assert from 'node:assert/strict'
import { statusKind, statusTone } from '../src/utils/statusTone.js'

test('paid is green, unpaid and overdue are red, partial is amber', () => {
  assert.equal(statusKind('Paid'), 'success')
  assert.equal(statusKind('Unpaid'), 'error')
  assert.equal(statusKind('OVERDUE'), 'error')
  assert.equal(statusKind('Partial'), 'warning')
})

test('pending is unpaid for invoices but waiting for cheques', () => {
  assert.equal(statusKind('Pending', 'invoice'), 'error')
  assert.equal(statusKind('PENDING', 'cheque'), 'warning')
})

test('a returned cheque is red, returned goods on an invoice are amber', () => {
  assert.equal(statusKind('RETURNED', 'cheque'), 'error')
  assert.equal(statusKind('Returned', 'invoice'), 'warning')
})

test('cleared is green; void and unknown are neutral', () => {
  assert.equal(statusKind('CLEARED', 'cheque'), 'success')
  assert.equal(statusKind('VOID', 'cheque'), 'neutral')
  assert.equal(statusKind(undefined), 'neutral')
})

test('border option adds the matching border colour', () => {
  assert.equal(statusTone('Paid', 'invoice', { border: true }), 'bg-success-bg text-success-fg border-success-border')
})
