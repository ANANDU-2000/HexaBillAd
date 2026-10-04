/**
 * §10 field/edge smoke on Phase 7 core pages (FH1 owner @360).
 * Checks: primary CTA ≥44px, empty-submit validation/required, search input present,
 * no blank body, staff-sensitive pages still load for owner.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'frontend/hexabill-ui/package.json'))
const { chromium } = require('playwright')

const API = process.env.HEXABILL_API || 'http://127.0.0.1:5000'
const FE = process.env.HEXABILL_FE || 'http://127.0.0.1:5173'
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret'
const PASS = process.env.HEXABILL_OWNER_PASSWORD || ''
const OUT = process.env.HEXABILL_FIELD_EDGE_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `field-edge-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`)

const PAGES = [
  { id: 'pos', path: '/pos', expectSearch: false },
  { id: 'ledger', path: '/ledger', expectSearch: true },
  { id: 'purchases', path: '/purchases', expectSearch: true },
  { id: 'suppliers', path: '/suppliers', expectSearch: true },
  { id: 'expenses', path: '/expenses', expectSearch: true },
  { id: 'products', path: '/products', expectSearch: true },
  { id: 'customers', path: '/customers', expectSearch: true },
]

function loadOwner (slug = 'frozenhub1') {
  const dirs = [
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'HexaBill_Backups'),
    path.join(process.env.USERPROFILE || '', 'Desktop', 'HexaBill_Backups'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('tier0-local-bootstrap-') && f.endsWith('.json')).sort()
    if (!files.length) continue
    const report = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
    const owner = (report.owners || []).find((o) => o.slug === slug)
    if (owner) return owner
  }
  return null
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
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const owner = loadOwner('frozenhub1')
  if (!owner) throw new Error('No frozenhub1 owner')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

  const session = await login(owner.slug, owner.email)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } })
  const page = await context.newPage()
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user, slug }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
    localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
  }, { token: session.token, user: session.user, slug: owner.slug })

  const report = { at: new Date().toISOString(), out: OUT, cells: {} }

  for (const p of PAGES) {
    const key = `fh1-owner-${p.id}-360-field-edge`
    const file = path.join(OUT, 'screenshots', `${key}.png`)
    const cell = { path: p.path, checks: {} }
    try {
      await page.goto(`${FE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(700)
      const text = await page.locator('body').innerText().catch(() => '')
      cell.checks.blank = text.trim().length < 20
      cell.checks.hasBodyText = text.trim().length >= 20

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
          // Mobile layouts may keep a desktop search in DOM but hidden — not a blank-page failure.
          cell.checks.searchTyped = false
        }
      }

      // Prefer clearly primary actions; skip tiny icon-only "New" chips under 40px tall when a better match exists.
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

      // Empty-ish form submit smoke: click Save/Create if visible and note validation text
      const saveBtn = page.getByRole('button', { name: /save|create|submit/i }).first()
      if (await saveBtn.count()) {
        await saveBtn.click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)
        const after = await page.locator('body').innerText().catch(() => '')
        cell.checks.validationOrStay = /required|invalid|enter|must|cannot|error|please/i.test(after) || page.url().includes(p.path)
      }

      await page.screenshot({ path: file, fullPage: false })
      cell.bytes = fs.statSync(file).size
      // Fail hard on blank shells; soft-warn under-44 CTAs / hidden search (recorded in checks).
      const fail = cell.checks.blank || (p.expectSearch && !cell.checks.searchPresent)
      cell.warn = cell.checks.primaryMin44 === false || (p.expectSearch && cell.checks.searchVisible === false)
      cell.status = fail ? 'fail' : 'captured'
      console.log(cell.status === 'captured' ? 'OK' : 'FAIL', key, JSON.stringify(cell.checks))
    } catch (e) {
      cell.status = 'fail'
      cell.error = String(e.message || e)
      console.error('FAIL', key, e.message || e)
    }
    report.cells[key] = cell
  }

  await browser.close()
  const ok = Object.values(report.cells).filter((c) => c.status === 'captured').length
  const fail = Object.values(report.cells).filter((c) => c.status !== 'captured').length
  report.summary = { ok, fail, total: ok + fail }
  const reportPath = path.join(OUT, 'field-edge-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath, `ok=${ok} fail=${fail}`)
  if (fail) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
