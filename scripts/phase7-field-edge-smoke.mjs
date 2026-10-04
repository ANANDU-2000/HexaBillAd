/**
 * §10 field/edge smoke on Phase 7/8 pages @360.
 * Env: HEXABILL_ROLE=owner|staff, HEXABILL_TENANTS, HEXABILL_PAGES=id:path:search,...
 * Checks: primary CTA ≥44px, search presence, no blank body; staff records deny banners.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'frontend/hexabill-ui/package.json'))
const { chromium } = require('playwright')

const API = process.env.HEXABILL_API || 'http://127.0.0.1:5000'
const FE = process.env.HEXABILL_FE || 'http://127.0.0.1:5173'
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret'
const ROLE = (process.env.HEXABILL_ROLE || 'owner').toLowerCase()
const PASS = ROLE === 'staff'
  ? (process.env.HEXABILL_STAFF_PASSWORD || '')
  : (process.env.HEXABILL_OWNER_PASSWORD || '')
const OUT = process.env.HEXABILL_FIELD_EDGE_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `field-edge-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`)
const ROLE_LABEL = ROLE === 'staff' ? 'staff' : 'owner'

/** Static owner routes from ROUTE-MANIFEST (no :id params). Param routes covered by phase8-param-routes. */
const DEFAULT_PAGES = [
  { id: 'dashboard', path: '/dashboard', expectSearch: false },
  { id: 'pos', path: '/pos', expectSearch: false },
  { id: 'billing-history', path: '/billing-history', expectSearch: true },
  { id: 'sales-ledger', path: '/sales-ledger', expectSearch: false },
  { id: 'ledger', path: '/ledger', expectSearch: true },
  { id: 'purchases', path: '/purchases', expectSearch: true },
  { id: 'expenses', path: '/expenses', expectSearch: true },
  { id: 'customers', path: '/customers', expectSearch: true },
  { id: 'products', path: '/products', expectSearch: true },
  { id: 'suppliers', path: '/suppliers', expectSearch: true },
  { id: 'branches', path: '/branches', expectSearch: false },
  { id: 'routes', path: '/routes', expectSearch: false },
  { id: 'delivery-notes', path: '/delivery-notes', expectSearch: false },
  { id: 'quotations', path: '/quotations', expectSearch: true },
  { id: 'quotations-new', path: '/quotations/new', expectSearch: false },
  { id: 'agreements', path: '/agreements', expectSearch: false },
  { id: 'agreements-new', path: '/agreements/new', expectSearch: false },
  { id: 'salary-certificates', path: '/salary-certificates', expectSearch: false },
  { id: 'salary-new', path: '/salary-certificates/new', expectSearch: false },
  { id: 'recurring-invoices', path: '/recurring-invoices', expectSearch: false },
  { id: 'returns', path: '/returns/create', expectSearch: false },
  { id: 'daily-close', path: '/daily-close', expectSearch: false },
  { id: 'vat-return', path: '/vat-return', expectSearch: false },
  { id: 'stock-adjustments', path: '/stock-adjustments', expectSearch: false },
  { id: 'pricelist', path: '/pricelist', expectSearch: false },
  { id: 'reports', path: '/reports', expectSearch: false },
  { id: 'reports-outstanding', path: '/reports/outstanding', expectSearch: false },
  { id: 'audit', path: '/audit', expectSearch: false },
  { id: 'backup', path: '/backup', expectSearch: false },
  { id: 'users', path: '/users', expectSearch: false },
  { id: 'settings', path: '/settings', expectSearch: false },
  { id: 'profile', path: '/profile', expectSearch: false },
  { id: 'help', path: '/help', expectSearch: false },
  { id: 'feedback', path: '/feedback', expectSearch: false },
  { id: 'more', path: '/more', expectSearch: false },
  { id: 'worksheet', path: '/worksheet', expectSearch: false },
]

const PAGES = process.env.HEXABILL_PAGES
  ? process.env.HEXABILL_PAGES.split(',').map((s) => {
    const [id, pth, search] = s.trim().split(':')
    return { id, path: pth, expectSearch: search === '1' || search === 'true' }
  }).filter((p) => p.id && p.path)
  : DEFAULT_PAGES

const TENANT_FILTER = (process.env.HEXABILL_TENANTS || 'frozenhub1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const SLUG_PREFIX = { frozenhub1: 'fh1', frozenhub2: 'fh2', gulfharvest: 'gh', zayoga: 'zy' }
const VIEWPORTS = (process.env.HEXABILL_VIEWPORTS || '360x800')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [w, h] = s.split('x').map(Number)
    return { id: s, w, h }
  })
  .filter((v) => v.w > 0 && v.h > 0)

function loadOwners () {
  const dirs = [
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'HexaBill_Backups'),
    path.join(process.env.USERPROFILE || '', 'Desktop', 'HexaBill_Backups'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('tier0-local-bootstrap-') && f.endsWith('.json')).sort()
    if (!files.length) continue
    const report = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
    const owners = report.owners || []
    if (!owners.length) continue
    return TENANT_FILTER.length
      ? owners.filter((o) => TENANT_FILTER.includes(o.slug))
      : owners
  }
  return []
}

async function login (slug, email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
    },
    body: JSON.stringify({ email, password: PASS }),
  })
  const json = await res.json().catch(() => ({}))
  const data = json?.data || json?.Data
  const token = data?.token
  if (!res.ok || !token) throw new Error(`login ${res.status}`)
  return {
    token,
    user: {
      id: data.userId,
      role: data.role || 'Owner',
      name: data.name || 'User',
      companyName: data.companyName,
      pageAccess: data.pageAccess ?? null,
      tenantId: data.tenantId,
      assignedBranchIds: data.assignedBranchIds || [],
      assignedRouteIds: data.assignedRouteIds || [],
      mustChangePassword: data.mustChangePassword ?? false,
    },
  }
}

async function main () {
  if (!PASS) throw new Error(ROLE === 'staff' ? 'Set HEXABILL_STAFF_PASSWORD' : 'Set HEXABILL_OWNER_PASSWORD')
  const owners = loadOwners()
  if (!owners.length) throw new Error('No bootstrap owners for selected tenants')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const report = { at: new Date().toISOString(), out: OUT, role: ROLE_LABEL, tenants: [], cells: {} }

  for (const owner of owners) {
    const prefix = SLUG_PREFIX[owner.slug] || owner.slug
    const email = ROLE === 'staff' ? `staff@${owner.slug}.hexabill.local` : owner.email
    let session
    try {
      session = await login(owner.slug, email)
    } catch (e) {
      report.tenants.push({ slug: owner.slug, status: 'login_fail', email, error: String(e.message || e) })
      continue
    }
    report.tenants.push({ slug: owner.slug, status: 'ok', email, role: session.user.role })

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
      const page = await context.newPage()
      await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
      await page.evaluate(({ token, user, slug }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
        localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
      }, { token: session.token, user: session.user, slug: owner.slug })

      for (const p of PAGES) {
        const key = `${prefix}-${ROLE_LABEL}-${p.id}-${vp.id}-field-edge`
        const file = path.join(OUT, 'screenshots', `${key}.png`)
        const cell = { path: p.path, slug: owner.slug, role: ROLE_LABEL, viewport: vp.id, checks: {} }
        try {
          await page.goto(`${FE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForTimeout(700)
          // Dismiss auto-open notifications / overlays that steal focus
          await page.keyboard.press('Escape').catch(() => {})
          await page.evaluate(() => {
            const close = [...document.querySelectorAll('button')].find((b) =>
              /close|dismiss/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')))
            close?.click()
          })
          await page.waitForTimeout(200)
          const text = await page.locator('body').innerText().catch(() => '')
          cell.checks.blank = text.trim().length < 20
          cell.checks.hasBodyText = text.trim().length >= 20
          cell.checks.denied = /access denied|forbidden|not authorized|no permission/i.test(text)

          const search = page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]').first()
          cell.checks.searchPresent = (await search.count()) > 0
          if (p.expectSearch && cell.checks.searchPresent) {
            const visible = await search.isVisible().catch(() => false)
            cell.checks.searchVisible = visible
            if (visible) {
              await search.fill('zzzz-no-match-hexabill')
              await page.waitForTimeout(400)
              cell.checks.searchTyped = true
            } else {
              cell.checks.searchTyped = false
            }
          }

          const candidates = page.locator('button').filter({ hasText: /add |new |create|save|record|pay |close day/i })
          const count = await candidates.count()
          let best = null
          for (let i = 0; i < Math.min(count, 8); i++) {
            const btn = candidates.nth(i)
            if (!(await btn.isVisible().catch(() => false))) continue
            const box = await btn.boundingBox()
            if (!box) continue
            const label = (await btn.innerText().catch(() => '')).trim().replace(/\s+/g, ' ').slice(0, 40)
            const score = box.height * box.width
            if (!best || score > best.score) best = { box, label, score }
          }
          if (best) {
            cell.checks.primaryFound = true
            cell.checks.primaryMin44 = best.box.height >= 44 && best.box.width >= 44
            cell.checks.primaryLabel = best.label
          } else {
            cell.checks.primaryFound = false
            cell.checks.primaryMin44 = null
          }

          const saveBtn = page.getByRole('button', { name: /save|create|submit/i }).first()
          if (await saveBtn.count()) {
            await saveBtn.click({ timeout: 2000 }).catch(() => {})
            await page.waitForTimeout(300)
            const after = await page.locator('body').innerText().catch(() => '')
            cell.checks.validationOrStay = /required|invalid|enter|must|cannot|error|please/i.test(after) || page.url().includes(p.path)
          }

          await page.screenshot({ path: file, fullPage: false })
          cell.bytes = fs.statSync(file).size
          // Hard-fail only on blank shells. Missing search / under-44 CTAs are warnings (matrix cell still recorded).
          const fail = cell.checks.blank
          cell.warn = (!cell.checks.denied && cell.checks.primaryMin44 === false)
            || (p.expectSearch && !cell.checks.searchPresent && !cell.checks.denied)
            || (p.expectSearch && cell.checks.searchVisible === false && !cell.checks.denied)
          cell.status = fail ? 'fail' : 'captured'
          console.log(cell.status === 'captured' ? 'OK' : 'FAIL', key, JSON.stringify(cell.checks))
        } catch (e) {
          cell.status = 'fail'
          cell.error = String(e.message || e)
          console.error('FAIL', key, e.message || e)
        }
        report.cells[key] = cell
      }
      await context.close()
    }
  }

  await browser.close()
  const ok = Object.values(report.cells).filter((c) => c.status === 'captured').length
  const fail = Object.values(report.cells).filter((c) => c.status !== 'captured').length
  const warn = Object.values(report.cells).filter((c) => c.warn).length
  report.summary = { ok, fail, warn, total: ok + fail }
  const reportPath = path.join(OUT, 'field-edge-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath, `ok=${ok} fail=${fail} warn=${warn}`)
  if (fail) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
