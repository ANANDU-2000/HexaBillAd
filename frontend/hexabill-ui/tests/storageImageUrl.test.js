import test from 'node:test'
import assert from 'node:assert/strict'
import { isAuthedStorageUrl, storageRequestPath } from '../src/utils/storageImageUrl.js'

// UIX-003: <img src> never sends the Authorization header, so storage images must be fetched through the API client.
test('isAuthedStorageUrl flags tenant storage paths only', () => {
  assert.equal(isAuthedStorageUrl('https://api.example.com/api/storage/tenants/3/logos/a.png'), true)
  assert.equal(isAuthedStorageUrl('/api/storage/tenants/3/logos/a.png?t=1'), true)
  assert.equal(isAuthedStorageUrl('storage/tenants/3/logos/a.png'), true)
  assert.equal(isAuthedStorageUrl('https://cdn.example.com/logo.png'), false)
  assert.equal(isAuthedStorageUrl(null), false)
  assert.equal(isAuthedStorageUrl(''), false)
})

test('storageRequestPath returns the path relative to the API base', () => {
  assert.equal(storageRequestPath('/api/storage/tenants/3/logos/a.png?t=1'), 'storage/tenants/3/logos/a.png')
  assert.equal(storageRequestPath('https://api.example.com/api/storage/tenants/3/logos/a.png'), 'storage/tenants/3/logos/a.png')
  assert.equal(storageRequestPath('storage/tenants/3/logos/a.png'), 'storage/tenants/3/logos/a.png')
})
