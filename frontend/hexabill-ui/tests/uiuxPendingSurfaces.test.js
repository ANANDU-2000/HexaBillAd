import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Phase 0 rows still open after the first pass: UIX-003 (editor logos), UIX-004 (platform host),
// UIX-006 (maintenance banner), UIX-007 (clear-data icons), UIX-014 (local document dates).
const here = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => readFileSync(join(here, '..', 'src', ...parts), 'utf8')

test('UIX003: document editors load tenant logos through the authed hook', () => {
  const editors = [
    src('features', 'documents', 'AgreementEditorPage.jsx'),
    src('features', 'documents', 'QuotationEditorPage.jsx'),
    src('features', 'documents', 'SalaryCertificateEditorPage.jsx'),
  ]
  for (const file of editors) {
    assert.match(file, /useAuthedImageSrc/)
    assert.doesNotMatch(file, /<img[^>]*src=\{(logoUrl|company\.logoUrl)\}/)
  }
})

test('UIX004: branding skips the platform host unless impersonating', () => {
  const branding = src('tenant', 'TenantBrandingContext.jsx')
  assert.match(branding, /getTenantHost\(\)\.mode === 'platform' && impersonatedTenantId == null/)
})

test('UIX006: super admin layout shows a banner while maintenance mode is on', () => {
  const layout = src('components', 'SuperAdminLayout.jsx')
  assert.match(layout, /maintenanceMode === true/)
  assert.match(layout, /Maintenance mode is on\. Tenant users see the maintenance screen/)
})

test('UIX007: clear-data buttons use the Trash2 icon, not History', () => {
  const tenantDetail = src('platform', 'SuperAdminTenantDetailPage.jsx')
  const settings = src('features', 'settings', 'SettingsPage.jsx')
  assert.match(tenantDetail, /<Trash2 className="h-5 w-5" \/>\s*Clear All Data/)
  assert.match(settings, /<Trash2 className="h-5 w-5" \/>\s*Clear all data/)
  assert.doesNotMatch(settings, /<History /)
})

test('UIX014: default local date is the local day at 00:30 UAE, not the UTC day', () => {
  // The child process runs with TZ=Asia/Dubai and a faked clock at 2026-10-25T00:30+04:00.
  // The old toISOString() default gave 2026-10-24 here.
  const helper = pathToFileURL(join(here, '..', 'src', 'utils', 'dateFormat.js')).href
  const script = `
    import { mock } from 'node:test'
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T00:30:00+04:00') })
    const { localDateString } = await import(${JSON.stringify(helper)})
    process.stdout.write(localDateString())
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'Asia/Dubai' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '2026-10-25')
})

test('UIX014: document editors and tenant detail no longer default to the UTC day', () => {
  const files = [
    src('features', 'documents', 'AgreementEditorPage.jsx'),
    src('features', 'documents', 'QuotationEditorPage.jsx'),
    src('features', 'documents', 'SalaryCertificateEditorPage.jsx'),
    src('platform', 'SuperAdminTenantDetailPage.jsx'),
  ]
  for (const file of files) {
    assert.doesNotMatch(file, /toISOString\(\)\.slice\(0, 10\)/)
  }
})
