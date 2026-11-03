import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isStaleChunkError,
  shouldAutoReloadForStaleChunk,
  STALE_CHUNK_RELOAD_KEY,
  STALE_CHUNK_RELOAD_WINDOW_MS,
} from '../src/utils/staleChunk.js'

const memoryStorage = () => {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    data,
  }
}

test('isStaleChunkError recognises chunk-load failures across browsers', () => {
  assert.equal(isStaleChunkError(new Error('Failed to fetch dynamically imported module: https://x/assets/A-1.js')), true)
  assert.equal(isStaleChunkError(new Error('Importing a module script failed.')), true)
  assert.equal(isStaleChunkError(new Error('Loading chunk 12 failed.')), true)
  assert.equal(isStaleChunkError(new Error('ChunkLoadError: boom')), true)
})

test('isStaleChunkError ignores ordinary render errors and empty input', () => {
  assert.equal(isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'id')")), false)
  assert.equal(isStaleChunkError(null), false)
  assert.equal(isStaleChunkError(undefined), false)
  assert.equal(isStaleChunkError({}), false)
})

test('shouldAutoReloadForStaleChunk allows one reload per window', () => {
  const storage = memoryStorage()
  const t0 = 1_000_000
  assert.equal(shouldAutoReloadForStaleChunk(storage, t0), true)
  assert.equal(storage.getItem(STALE_CHUNK_RELOAD_KEY), String(t0))
  assert.equal(shouldAutoReloadForStaleChunk(storage, t0 + 1000), false)
  assert.equal(shouldAutoReloadForStaleChunk(storage, t0 + STALE_CHUNK_RELOAD_WINDOW_MS - 1), false)
  assert.equal(shouldAutoReloadForStaleChunk(storage, t0 + STALE_CHUNK_RELOAD_WINDOW_MS), true)
})

test('shouldAutoReloadForStaleChunk never reloads without usable storage', () => {
  assert.equal(shouldAutoReloadForStaleChunk(null, 5), false)
  assert.equal(shouldAutoReloadForStaleChunk(undefined, 5), false)
  const broken = {
    getItem: () => { throw new Error('SecurityError') },
    setItem: () => { throw new Error('SecurityError') },
  }
  assert.equal(shouldAutoReloadForStaleChunk(broken, 5), false)
})
