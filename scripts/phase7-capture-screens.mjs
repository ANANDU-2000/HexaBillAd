/**
 * Phase 7 viewport screenshots via Playwright (local only).
 * Logs in each tenant owner, sets loopback Original-Host override, captures 6×5.
 *
 * Usage:
 *   HEXABILL_OWNER_PASSWORD=... node scripts/phase7-capture-screens.mjs
 *   HEXABILL_ROLE=staff HEXABILL_STAFF_PASSWORD=... node scripts/phase7-capture-screens.mjs
 * Env: HEXABILL_API, HEXABILL_FE, HEXABILL_EDGE_PROXY_SECRET, HEXABILL_OWNER_PASSWORD
 *      HEXABILL_PHASE7_OUT (screenshot dir; ignores stale HEXABILL_EVIDENCE_DIR)
 *      HEXABILL_TENANTS=frozenhub1,frozenhub2,gulfharvest,zayoga
 *      HEXABILL_ROLE=owner|staff (default owner). Staff emails: staff@{slug}.hexabill.local
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
const OUT = process.env.HEXABILL_PHASE7_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', 'phase7-matrix-20261004-111213', 'screenshots')

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
]
const PAGES = [
  { id: 'pos', path: '/pos' },
  { id: 'ledger', path: '/ledger' },
  { id: 'purchases', path: '/purchases' },
  { id: 'suppliers', path: '/suppliers' },
  { id: 'expenses', path: '/expenses' },
  { id: 'products', path: '/products' },
]
const SLUG_PREFIX = {
  frozenhub1: 'fh1',
  frozenhub2: 'fh2',
  gulfharvest: 'gh',
  zayoga: 'zy',
}

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
    if (report.owners?.length) return report.owners
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
  const token = data?.token || data?.Token
  if (!res.ok || !token) throw new Error(`${slug} login ${res.status}: ${json?.message || json?.Message || ''}`)
  return {
    token,
    user: {
      id: data.userId ?? data.UserId,
      role: data.role || data.Role || 'Owner',
      name: data.name || data.Name || 'User',
      companyName: data.companyName || data.CompanyName,
      dashboardPermissions: data.dashboardPermissions ?? data.DashboardPermissions ?? null,
      pageAccess: data.pageAccess ?? data.PageAccess ?? null,
      tenantId: data.tenantId ?? data.TenantId,
      assignedBranchIds: data.assignedBranchIds || data.AssignedBranchIds || [],
      assignedRouteIds: data.assignedRouteIds || data.AssignedRouteIds || [],
      mustChangePassword: data.mustChangePassword ?? data.MustChangePassword ?? false,
    },
  }
}

async function main () {
  if (!PASS) {
    throw new Error(ROLE === 'staff' ? 'Set HEXABILL_STAFF_PASSWORD' : 'Set HEXABILL_OWNER_PASSWORD')
  }
  const want = (process.env.HEXABILL_TENANTS || 'frozenhub1,frozenhub2,gulfharvest,zayoga')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const owners = loadOwners().filter((o) => want.includes(o.slug))
  if (!owners.length) throw new Error('No owners from bootstrap report')
  const roleLabel = ROLE === 'staff' ? 'staff' : 'owner'

  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = { at: new Date().toISOString(), out: OUT, role: roleLabel, cells: {}, tenants: [] }

  for (const owner of owners) {
    const prefix = SLUG_PREFIX[owner.slug] || owner.slug
    const email = ROLE === 'staff' ? `staff@${owner.slug}.hexabill.local` : owner.email
    let session
    try {
      session = await login(owner.slug, email)
    } catch (e) {
      report.tenants.push({ slug: owner.slug, status: 'login_fail', email, error: String(e.message || e) })
      console.error('LOGIN_FAIL', owner.slug, email, e.message || e)
      continue
    }
    report.tenants.push({ slug: owner.slug, status: 'ok', email, role: session.user.role })

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user, slug }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
      localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
    }, { token: session.token, user: session.user, slug: owner.slug })

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      for (const route of PAGES) {
        const key = `${prefix}-${roleLabel}-${route.id}-${vp.name}`
        const file = path.join(OUT, `${key}.png`)
        try {
          await page.goto(`${FE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 })
          await page.waitForTimeout(600)
          if (route.id === 'expenses') {
            const tab = page.getByRole('tab', { name: /By category/i })
            if (await tab.count()) {
              await tab.first().click().catch(() => {})
              await page.waitForTimeout(250)
            }
          }
          const bodyText = await page.locator('body').innerText().catch(() => '')
          const denied = /access denied|forbidden|not authorized/i.test(bodyText)
          await page.screenshot({ path: file, fullPage: false })
          // Staff denial on admin pages is valid evidence (still captured).
          report.cells[key] = {
            status: 'captured',
            bytes: fs.statSync(file).size,
            denied,
            role: session.user.role,
          }
          console.log(denied ? 'DENY' : 'OK', key, fs.statSync(file).size)
        } catch (e) {
          report.cells[key] = { status: 'fail', error: String(e.message || e) }
          console.error('FAIL', key, e.message || e)
        }
      }
    }
    await context.close()
  }

  await browser.close()
  const reportPath = path.join(path.dirname(OUT), `phase7-screens-report-${roleLabel}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  const ok = Object.values(report.cells).filter((c) => c.status === 'captured').length
  const fail = Object.values(report.cells).filter((c) => c.status === 'fail').length
  const denied = Object.values(report.cells).filter((c) => c.denied).length
  console.log('Wrote', reportPath, `ok=${ok} fail=${fail} denied=${denied}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
