import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// UIX-002: the SQL console is not in the main super admin nav. It is reached from Infrastructure.
const here = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => readFileSync(join(here, '..', 'src', ...parts), 'utf8')

test('UIX002: SQL Console is not in the tenant or super admin nav config', () => {
  assert.equal(src('navigation', 'moreMenuConfig.js').includes('sql-console'), false)
  assert.equal(src('components', 'SuperAdminLayout.jsx').includes('sql-console'), false)
})

test('UIX002: Infrastructure page links to the SQL console', () => {
  assert.equal(src('platform', 'SuperAdminHealthPage.jsx').includes('href="/superadmin/sql-console"'), true)
})

test('UIX002: the SQL console route still exists', () => {
  assert.equal(src('app', 'App.jsx').includes('sql-console'), true)
})
