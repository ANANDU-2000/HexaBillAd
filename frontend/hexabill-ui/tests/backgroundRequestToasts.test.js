import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// UIX-004: background calls (branding, logo) must not raise error toasts. Real saves still do.
const here = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => readFileSync(join(here, '..', 'src', ...parts), 'utf8')

test('UIX004: the API error reporter honours a per-request silent flag', () => {
  const api = src('services', 'api.js')
  assert.match(api, /error\.config\?\.silent === true/)
})

test('UIX004: the logo data URI request is silent', () => {
  const index = src('services', 'index.js')
  assert.match(index, /getLogoDataUri:[\s\S]*?api\.get\('\/settings\/logo-data-uri', \{ silent: true \}\)/)
})
