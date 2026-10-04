import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const manifest = JSON.parse(readFileSync(join(root, 'docs/plan/ROUTE-MANIFEST.json'), 'utf8'))
const appSource = readFileSync(join(root, 'frontend/hexabill-ui/src/app/App.jsx'), 'utf8')

test('route manifest matches unique App.jsx paths', () => {
  const paths = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])
  const unique = [...new Set(paths)].sort()
  assert.deepEqual(unique, [...manifest.paths].sort())
  assert.equal(unique.length, manifest.uniqueRoutePathCount)
})
