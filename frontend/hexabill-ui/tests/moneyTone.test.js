import test from 'node:test'
import assert from 'node:assert/strict'
import { moneyTone, moneyWord } from '../src/utils/moneyTone.js'

test('owed money is red, received money is green, zero is quiet', () => {
  assert.equal(moneyTone('due', 120), 'text-error-fg')
  assert.equal(moneyTone('overdue', 5), 'text-error-fg')
  assert.equal(moneyTone('paid', 78), 'text-success-fg')
  assert.equal(moneyTone('due', 0), 'text-neutral-500')
  assert.equal(moneyTone('paid', undefined), 'text-neutral-500')
})

test('a supplier credit (negative payable) is green, not black', () => {
  assert.equal(moneyTone('due', -79.5), 'text-success-fg')
})

test('colour always comes with a word', () => {
  assert.equal(moneyWord('due', 10), 'Due')
  assert.equal(moneyWord('due', -79.5), 'Credit')
  assert.equal(moneyWord('overdue', 3), 'Overdue')
  assert.equal(moneyWord('due', 0), '')
  assert.equal(moneyWord('paid', 50), '')
})
