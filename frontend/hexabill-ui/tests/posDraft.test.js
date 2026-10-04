import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { getPosDraftKey, usePosDraft } from '../src/features/sales/pos/hooks/usePosDraft.js'

let storage
let renderer
let draft
let originalStorage
const snapshot = { cart: [{ productId: 42, qty: 2 }], notes: 'Owner A private draft' }

function Harness(props) {
  draft = usePosDraft(props)
  return null
}

function mount(overrides = {}) {
  const props = { tenantId: 10, userId: 1, enabled: true,
    getSnapshot: () => snapshot, intervalMs: 1_000_000, ...overrides }
  act(() => { renderer = create(React.createElement(Harness, props)) })
  return props
}

function seed(tenantId, userId, data = snapshot, savedAt = Date.now()) {
  const key = getPosDraftKey(tenantId, userId)
  storage.set(key, JSON.stringify({ version: 1, scope: key, snapshot: data, savedAt }))
}

beforeEach(() => {
  originalStorage = globalThis.localStorage
  storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
})

afterEach(() => {
  if (renderer) act(() => renderer.unmount())
  renderer = null
  globalThis.localStorage = originalStorage
})

test('save, reload and clear only the current owner draft', () => {
  seed(10, 2, { cart: [{ productId: 99 }] })
  mount()
  act(() => draft.saveDraftNow())
  assert.deepEqual(JSON.parse(storage.get(getPosDraftKey(10, 1))).snapshot, snapshot)
  act(() => renderer.unmount())
  const restored = []
  mount({ onRestore: (data) => restored.push(data) })
  assert.deepEqual(restored, [snapshot])
  act(() => draft.clearDraft())
  assert.equal(storage.has(getPosDraftKey(10, 1)), false)
  assert.equal(storage.has(getPosDraftKey(10, 2)), true)
})

test('another user and another tenant cannot restore the first owner draft', () => {
  seed(10, 1)
  const restored = []
  const props = mount({ userId: 2, onRestore: (data) => restored.push(data) })
  act(() => renderer.update(React.createElement(Harness, { ...props, tenantId: 11, userId: 1 })))
  assert.deepEqual(restored, [])
})

test('unresolved identities cannot save, clear or restore shared fallback drafts', () => {
  storage.set('hexabill_pos_draft_default', JSON.stringify(snapshot))
  for (const bad of [undefined, null, '', 'default', 0, -1, true, '1/2', NaN]) {
    assert.equal(getPosDraftKey(bad, 1), null)
    assert.equal(getPosDraftKey(10, bad), null)
  }
  mount({ tenantId: 'default' })
  act(() => { draft.saveDraftNow(); draft.clearDraft() })
  assert.equal(storage.size, 1)
  assert.equal(draft.draftKey, null)
})

test('legacy unowned drafts and envelopes copied from another owner are not restored', () => {
  storage.set('hexabill_pos_draft_10', JSON.stringify({ ...snapshot, savedAt: Date.now() }))
  seed(10, 1)
  storage.set(getPosDraftKey(10, 2), storage.get(getPosDraftKey(10, 1)))
  const restored = []
  mount({ userId: 2, onRestore: (data) => restored.push(data) })
  assert.deepEqual(restored, [])
})

test('switching identities invalidates previously captured save/clear callbacks', () => {
  seed(10, 1)
  seed(11, 2, { cart: [{ productId: 99 }] })
  const restored = []
  const props = mount({ onRestore: (data) => restored.push(data) })
  const oldDraft = draft
  act(() => renderer.update(React.createElement(Harness, {
    ...props, tenantId: 11, userId: 2, getSnapshot: () => ({ cart: [{ productId: 99 }] }),
  })))
  const previous = storage.get(getPosDraftKey(10, 1))
  act(() => { oldDraft.saveDraftNow(); oldDraft.clearDraft() })
  assert.equal(storage.get(getPosDraftKey(10, 1)), previous)
  assert.equal(restored.length, 2)
  assert.equal(restored[1].cart[0].productId, 99)
})

test('edit and disabled sessions do not restore or save drafts', () => {
  seed(10, 1)
  const before = storage.get(getPosDraftKey(10, 1))
  const restored = []
  const props = mount({ isEditMode: true, onRestore: (data) => restored.push(data) })
  act(() => draft.saveDraftNow())
  act(() => renderer.update(React.createElement(Harness, { ...props, isEditMode: false, enabled: false })))
  act(() => draft.saveDraftNow())
  assert.deepEqual(restored, [])
  assert.equal(storage.get(getPosDraftKey(10, 1)), before)
})

test('read-only support cannot restore, save or clear an owner draft', () => {
  seed(10, 1)
  const before = storage.get(getPosDraftKey(10, 1))
  const restored = []
  mount({ readOnly: true, onRestore: (data) => restored.push(data) })
  act(() => { draft.saveDraftNow(); draft.clearDraft() })
  assert.deepEqual(restored, [])
  assert.equal(storage.get(getPosDraftKey(10, 1)), before)
})

test('a read-only transition also invalidates earlier writable callbacks', () => {
  seed(10, 1)
  const before = storage.get(getPosDraftKey(10, 1))
  const props = mount()
  const oldDraft = draft
  act(() => renderer.update(React.createElement(Harness, { ...props, readOnly: true })))
  act(() => { oldDraft.saveDraftNow(); oldDraft.clearDraft() })
  assert.equal(storage.get(getPosDraftKey(10, 1)), before)
})

test('expired, future-dated and malformed drafts fail without breaking POS', () => {
  const props = mount()
  const restored = []
  const values = [Date.now() - 25 * 60 * 60 * 1000, Date.now() + 60_000, 'invalid']
  values.forEach((savedAt, i) => {
    const userId = i + 2
    seed(10, userId, snapshot, savedAt)
    act(() => renderer.update(React.createElement(Harness, {
      ...props, userId, onRestore: (data) => restored.push(data),
    })))
    assert.equal(storage.has(getPosDraftKey(10, userId)), false)
  })
  storage.set(getPosDraftKey(10, 9), '{bad JSON')
  act(() => renderer.update(React.createElement(Harness, {
    ...props, userId: 9, onRestore: (data) => restored.push(data),
  })))
  assert.deepEqual(restored, [])
})

test('blocked browser storage does not crash invoice work', () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error('Storage blocked') },
    setItem: () => { throw new Error('Storage blocked') },
    removeItem: () => { throw new Error('Storage blocked') },
  }
  assert.doesNotThrow(() => mount())
  assert.doesNotThrow(() => act(() => { draft.saveDraftNow(); draft.clearDraft() }))
})
