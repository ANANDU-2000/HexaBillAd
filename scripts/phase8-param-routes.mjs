/**
 * Phase 8: resolve seeded IDs per tenant and screenshot param routes at 360x800.
 * Usage: HEXABILL_OWNER_PASSWORD=... node scripts/phase8-param-routes.mjs
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
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', 'phase8-shell-20261004', 'params')

const SLUG_PREFIX = { frozenhub1: 'fh1', frozenhub2: 'fh2', gulfharvest: 'gh', zayoga: 'zy' }

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

async function api (slug, token, urlPath) {
  const res = await fetch(`${API}${urlPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
    },
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
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
  if (!res.ok || !token) throw new Error(`${slug} login ${res.status}`)
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

function firstItem (json) {
  const d = json?.data || json?.Data
  if (!d) return null
  const items = d.items || d.Items || (Array.isArray(d) ? d : null)
  if (!Array.isArray(items) || !items.length) return null
  return items[0]
}

function idOf (row) {
  if (!row) return null
  return row.id ?? row.Id ?? null
}

async function resolveIds (slug, token) {
  const [cust, prod, sup, br, rt, sales, quotes, agreements, salary] = await Promise.all([
    api(slug, token, '/api/customers?page=1&pageSize=5'),
    api(slug, token, '/api/products?page=1&pageSize=5'),
    api(slug, token, '/api/suppliers/summary'),
    api(slug, token, '/api/branches'),
    api(slug, token, '/api/routes'),
    api(slug, token, '/api/sales?page=1&pageSize=5'),
    api(slug, token, '/api/quotations?page=1&pageSize=5'),
    api(slug, token, '/api/agreements?page=1&pageSize=5'),
    api(slug, token, '/api/salary-certificates?page=1&pageSize=5'),
  ])
  const supplier = firstItem(sup.json) || (Array.isArray(sup.json?.data) ? sup.json.data[0] : Array.isArray(sup.json?.Data) ? sup.json.Data[0] : null)
  const supplierName = supplier?.supplierName || supplier?.SupplierName || supplier?.name || supplier?.Name || null
  return {
    customerId: idOf(firstItem(cust.json)),
    productId: idOf(firstItem(prod.json)),
    supplierName,
    branchId: idOf(firstItem(br.json)),
    routeId: idOf(firstItem(rt.json)),
    saleId: idOf(firstItem(sales.json)),
    quotationId: idOf(firstItem(quotes.json)),
    agreementId: idOf(firstItem(agreements.json)),
    salaryId: idOf(firstItem(salary.json)),
  }
}

function buildRoutes (ids) {
  const routes = []
  if (ids.customerId) routes.push({ id: 'customers_id', path: `/customers/${ids.customerId}` })
  if (ids.productId) routes.push({ id: 'products_id', path: `/products/${ids.productId}` })
  if (ids.supplierName) routes.push({ id: 'suppliers_name', path: `/suppliers/${encodeURIComponent(ids.supplierName)}` })
  if (ids.branchId) routes.push({ id: 'branches_id', path: `/branches/${ids.branchId}` })
  if (ids.routeId) routes.push({ id: 'routes_id', path: `/routes/${ids.routeId}` })
  if (ids.saleId) routes.push({ id: 'delivery-notes_saleId', path: `/delivery-notes/${ids.saleId}` })
  if (ids.quotationId) routes.push({ id: 'quotations_id', path: `/quotations/${ids.quotationId}` })
  if (ids.agreementId) routes.push({ id: 'agreements_id', path: `/agreements/${ids.agreementId}` })
  if (ids.salaryId) routes.push({ id: 'salary-certificates_id', path: `/salary-certificates/${ids.salaryId}` })
  // Always hit "new" detail shells already covered; tenant admin detail for superadmin skipped here
  return routes
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const owners = loadOwners()
  if (!owners.length) throw new Error('No bootstrap owners')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const report = { at: new Date().toISOString(), out: OUT, cells: {}, tenants: [] }

  for (const owner of owners) {
    const prefix = SLUG_PREFIX[owner.slug] || owner.slug
    let session
    try {
      session = await login(owner.slug, owner.email)
    } catch (e) {
      report.tenants.push({ slug: owner.slug, status: 'login_fail', error: String(e.message || e) })
      continue
    }
    const ids = await resolveIds(owner.slug, session.token)
    const routes = buildRoutes(ids)
    report.tenants.push({ slug: owner.slug, status: 'ok', ids, routeCount: routes.length })

    const context = await browser.newContext({ viewport: { width: 360, height: 800 } })
    const page = await context.newPage()
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user, slug }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
      localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
    }, { token: session.token, user: session.user, slug: owner.slug })

    for (const route of routes) {
      const key = `${prefix}-owner-${route.id}-360x800`
      const file = path.join(OUT, 'screenshots', `${key}.png`)
      try {
        await page.goto(`${FE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(500)
        const text = await page.locator('body').innerText().catch(() => '')
        const denied = /access denied|forbidden/i.test(text)
        const blank = text.trim().length < 20
        await page.screenshot({ path: file, fullPage: false })
        report.cells[key] = {
          status: denied || blank ? 'fail' : 'captured',
          path: route.path,
          denied,
          blank,
          bytes: fs.statSync(file).size,
        }
        console.log(report.cells[key].status === 'captured' ? 'OK' : 'FAIL', key, route.path)
      } catch (e) {
        report.cells[key] = { status: 'fail', path: route.path, error: String(e.message || e) }
        console.error('FAIL', key, e.message || e)
      }
    }
    await context.close()
  }

  await browser.close()
  const ok = Object.values(report.cells).filter((c) => c.status === 'captured').length
  const fail = Object.values(report.cells).filter((c) => c.status !== 'captured').length
  report.summary = { ok, fail, total: ok + fail }
  const reportPath = path.join(OUT, 'phase8-param-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath, `ok=${ok} fail=${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
