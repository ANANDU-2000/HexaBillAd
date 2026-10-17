import test from 'node:test'
import assert from 'node:assert/strict'
import { pickerKey } from '../src/utils/pickerNav.js'

test('arrows wrap and open', () => {
  assert.deepEqual(pickerKey('ArrowDown', -1, 3), { active: 0, action: 'open' })
  assert.equal(pickerKey('ArrowDown', 2, 3).active, 0)
  assert.equal(pickerKey('ArrowUp', 0, 3).active, 2)
  assert.equal(pickerKey('ArrowUp', -1, 3).active, 2)
})
test('Enter selects only an active row; Escape closes', () => {
  assert.equal(pickerKey('Enter', -1, 3).action, null)
  assert.equal(pickerKey('Enter', 1, 3).action, 'select')
  assert.equal(pickerKey('Escape', 1, 3).action, 'close')
})
test('empty list never yields an index', () => {
  assert.deepEqual(pickerKey('ArrowDown', 0, 0), { active: -1, action: null })
  assert.equal(pickerKey('Escape', 0, 0).action, 'close')
})
