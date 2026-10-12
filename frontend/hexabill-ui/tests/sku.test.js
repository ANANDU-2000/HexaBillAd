import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSku, suggestSkuFromName } from '../src/utils/sku.js'

test('spaces and symbols become single dashes', () => {
  assert.equal(normalizeSku('BEEF 250gm'), 'BEEF-250gm')
  assert.equal(normalizeSku('  Chicken  Wings / 1kg  '), 'Chicken-Wings-1kg')
  assert.equal(normalizeSku('A&B (large)'), 'A-B-large')
})

test('valid SKUs are unchanged', () => {
  assert.equal(normalizeSku('GH-001_A.2'), 'GH-001_A.2')
})

test('length is capped and never ends with a separator', () => {
  const out = normalizeSku(`${'A'.repeat(49)} B`)
  assert.ok(out.length <= 50)
  assert.ok(!/[-._]$/.test(out))
})

test('suggestion is upper case and empty for names without latin letters or digits', () => {
  assert.equal(suggestSkuFromName('Beef Nan 250gm'), 'BEEF-NAN-250GM')
  assert.equal(suggestSkuFromName('لحم'), '')
  assert.equal(suggestSkuFromName(''), '')
})
