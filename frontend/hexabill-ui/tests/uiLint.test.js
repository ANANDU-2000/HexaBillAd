import test from 'node:test'
import assert from 'node:assert/strict'
import { scanSource, compare } from '../scripts/ui-lint.mjs'

test('detects off-palette colours, native dialogs and border-l-4', () => {
  const r = scanSource('<div className="bg-violet-500 border-l-4">{window.confirm("x")}</div>', 'src/pages/A.jsx')
  assert.equal(r.offPalette, 1)
  assert.equal(r.borderL4, 1)
  assert.equal(r.nativeDialog, 1)
})

test('border-l-4 allowed in Alert primitive', () => {
  assert.deepEqual(scanSource('border-l-4', 'src/components/ui/Alert.jsx'), {})
})

test('compare fails only when counts increase', () => {
  assert.deepEqual(compare({ a: { borderL4: 2 } }, { a: { borderL4: 3 } }), [])
  assert.equal(compare({ a: { borderL4: 4 } }, { a: { borderL4: 3 } }).length, 1)
  assert.equal(compare({ b: { emoji: 1 } }, {}).length, 1)
})
