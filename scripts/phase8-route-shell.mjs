/**
 * Phase 8: shell-load every static (non-param) path from ROUTE-MANIFEST.json
 * for each tenant owner via Playwright + loopback override.
 *
 * Usage: HEXABILL_OWNER_PASSWORD=... node scripts/phase8-route-shell.mjs
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
const OUT = process.env.HEXABILL_PHASE8_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `phase8-shell-${Date.now()}`)
const MANIFEST = path.join(process.cwd(), 'docs/plan/ROUTE-MANIFEST.json')
const VIEWPORTS = (process.env.HEXABILL_VIEWPORTS || '360x800')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((name) => {
    const [w, h] = name.split('x').map(Number)
    return { name, width: w, height: h }
  })
const TENANT_FILTER = (process.env.HEXABILL_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const SKIP_PREFIX = ['/superadmin', '/Admin26', '/signup', '/login', '/onboarding']
const SLUG_PREFIX = { frozenhub1: 'fh1', frozenhub2: 'fh2', gulfharvest: 'gh', zayoga: 'zy' }

function staticPaths () {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  return (m.paths || [])
    .filter((p) => p && p !== '*' && !p.includes(':') && !SKIP_PREFIX.some((s) => p === s || p.startsWith(s + '/')))
    .sort()
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
  if (!res.ok || !token) throw new Error(`${slug} login ${res.status}`)
  return {
    token,
    user: {
      id: data.userId ?? data.UserId,
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

function routeId (p) {
  return (p === '/' ? 'root' : p.replace(/^\//, '').replace(/\//g, '_'))
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const routes = staticPaths()
  let owners = loadOwners()
  if (TENANT_FILTER.length) owners = owners.filter((o) => TENANT_FILTER.includes(o.slug))
  if (!owners.length) throw new Error('No bootstrap owners')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const report = {
    at: new Date().toISOString(),
    out: OUT,
    viewports: VIEWPORTS.map((v) => v.name),
    routes,
    routeCount: routes.length,
    cells: {},
    tenants: [],
  }

  for (const owner of owners) {
    const prefix = SLUG_PREFIX[owner.slug] || owner.slug
    let session
    try {
      session = await login(owner.slug, owner.email)
      report.tenants.push({ slug: owner.slug, status: 'ok' })
    } catch (e) {
      report.tenants.push({ slug: owner.slug, status: 'login_fail', error: String(e.message || e) })
      continue
    }

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
      for (const route of routes) {
        const id = routeId(route)
        const key = `${prefix}-owner-${id}-${vp.name}`
        const file = path.join(OUT, 'screenshots', `${key}.png`)
        try {
          const resp = await page.goto(`${FE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForTimeout(400)
          const title = await page.title()
          const bodyText = await page.locator('body').innerText().catch(() => '')
          const denied = /access denied|forbidden|not found|page not found/i.test(bodyText)
          const blank = bodyText.trim().length < 20
          await page.screenshot({ path: file, fullPage: false })
          const status = resp?.status() || 0
          const cell = {
            status: denied || blank ? 'fail' : 'captured',
            http: status,
            title,
            denied,
            blank,
            bytes: fs.existsSync(file) ? fs.statSync(file).size : 0,
          }
          report.cells[key] = cell
          console.log(cell.status === 'captured' ? 'OK' : 'FAIL', key, cell.http, cell.bytes)
        } catch (e) {
          report.cells[key] = { status: 'fail', error: String(e.message || e) }
          console.error('FAIL', key, e.message || e)
        }
      }
    }
    await context.close()
  }

  await browser.close()
  const ok = Object.values(report.cells).filter((c) => c.status === 'captured').length
  const fail = Object.values(report.cells).filter((c) => c.status !== 'captured').length
  report.summary = { ok, fail, total: ok + fail }
  const reportPath = path.join(OUT, 'phase8-shell-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath, `ok=${ok} fail=${fail} routes=${routes.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
