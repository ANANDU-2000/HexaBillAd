import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// UIX-005, UIX-007, UIX-009, UIX-014: source-level checks for the Phase 0 safety and trust rows.
const here = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => readFileSync(join(here, '..', 'src', ...parts), 'utf8')

test('UIX005: super admin tenant list says "Open read-only support" with primary colour, not indigo', () => {
  const page = src('platform', 'SuperAdminDashboard.jsx')
  assert.equal(page.includes('Impersonate'), false)
  assert.equal(page.includes('Open read-only support'), true)
  assert.equal(page.includes('bg-indigo-600'), false)
})

test('UIX007: Profile has no destructive "Clear all data" control', () => {
  const page = src('pages', 'company', 'ProfilePage.jsx')
  assert.equal(page.includes('Clear all data'), false)
  assert.equal(page.includes('Danger zone'), false)
})

test('UIX009: the dead "Live Chat" contact (action "#") is removed', () => {
  const page = src('pages', 'HelpPage.jsx')
  assert.equal(page.includes('Live Chat'), false)
  assert.equal(/action:\s*'#'/.test(page), false)
})

test('UIX014: document editors and tenant VAT date use the local day, not the UTC day', () => {
  const files = [
    ['features', 'documents', 'AgreementEditorPage.jsx'],
    ['features', 'documents', 'QuotationEditorPage.jsx'],
    ['features', 'documents', 'SalaryCertificateEditorPage.jsx'],
    ['platform', 'SuperAdminTenantDetailPage.jsx'],
    ['features', 'reports', 'ReportsPage.jsx'],
  ]
  for (const parts of files) {
    assert.equal(src(...parts).includes('toISOString().slice(0, 10)'), false, parts.join('/'))
  }
})

test('UIX006: maintenance mode is a switch that asks before turning on, and says so', () => {
  const page = src('platform', 'SuperAdminSettingsPage.jsx')
  assert.equal(page.includes('role="switch"'), true)
  assert.equal(page.includes('window.confirm('), true)
  assert.equal(page.includes('Maintenance mode is on'), true)
})
