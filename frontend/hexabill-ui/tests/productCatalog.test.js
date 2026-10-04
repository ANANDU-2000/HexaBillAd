import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { useProductCatalog } from '../src/features/sales/pos/hooks/useProductCatalog.js'

let renderer, catalog, storage, previousStorage
const products = [{ id: 1, nameEn: 'Apple' }, { id: 2, nameEn: 'Banana' }]
const props = { products, cart: [], searchTerm: '', tenantId: 10, userId: 1 }
function Harness(input) { catalog = useProductCatalog(input); return null }
function mount(input = props) {
  act(() => { renderer = create(React.createElement(Harness, input)) })
}
function update(input) {
  act(() => { renderer.update(React.createElement(Harness, input)) })
}
beforeEach(() => {
  previousStorage = globalThis.localStorage
  storage = new Map()
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) }
})
afterEach(() => {
  if (renderer) act(() => renderer.unmount())
  renderer = null
  globalThis.localStorage = previousStorage
})

test('product ranking persists for its owner and does not affect another user or tenant', () => {
  mount()
  act(() => catalog.recordProductBilled(2))
  assert.deepEqual(catalog.frequent.map((item) => item.id), [2])
  assert.deepEqual(catalog.flat.map((item) => item.id), [2, 1])
  update({ ...props, userId: 2 })
  assert.deepEqual(catalog.frequent, [])
  act(() => catalog.recordProductBilled(1))
  update({ ...props, tenantId: 11 })
  assert.deepEqual(catalog.frequent, [])
  update(props)
  assert.deepEqual(catalog.frequent.map((item) => item.id), [2])
  assert.equal(storage.size, 2)
})

test('legacy, wrong-scope and malformed history cannot affect the catalog or break selection', () => {
  storage.set('hexabill_pos_product_freq', JSON.stringify({ 2: 99 }))
  storage.set('hexabill_pos_last_billed', JSON.stringify([2]))
  const key = 'hexabill_pos_draft_v1_10_1_product_history'
  storage.set(key, JSON.stringify({ version: 1, scope: 'another owner', entries: [['2', 99]] }))
  mount()
  assert.deepEqual(catalog.frequent, [])
  storage.set(key, JSON.stringify({ version: 1, scope: key,
    entries: [null, ['2', '99'], ['1', -1], ['__proto__', 10]] }))
  act(() => catalog.recordProductBilled(2))
  assert.deepEqual(catalog.frequent.map((item) => item.id), [2])
})

test('unresolved identity, stale callbacks and read-only support cannot write product history', () => {
  mount()
  const oldRecord = catalog.recordProductBilled
  update({ ...props, userId: 2 })
  act(() => oldRecord(2))
  assert.equal(storage.size, 0)
  const currentRecord = catalog.recordProductBilled
  update({ ...props, userId: 2, readOnly: true })
  act(() => { currentRecord(2); catalog.recordProductBilled(2) })
  assert.equal(storage.size, 0)
  update({ ...props, tenantId: 'default' })
  act(() => catalog.recordProductBilled(2))
  assert.equal(storage.size, 0)
})

test('blocked storage and invalid product identifiers leave selection usable', () => {
  mount()
  act(() => { catalog.recordProductBilled(null); catalog.recordProductBilled('__proto__') })
  assert.equal(storage.size, 0)
  globalThis.localStorage = { getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') } }
  act(() => catalog.recordProductBilled(2))
  assert.deepEqual(catalog.flat.map((item) => item.id), [1, 2])
})
