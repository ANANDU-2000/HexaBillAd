/**
 * Phase 7 section-10 matrix helper (no new browser dependency).
 * Records API reachability + emits a checklist JSON for the five viewports.
 * Screenshots are captured via Cursor browser / manual pass into HEXABILL_EVIDENCE_DIR.
 *
 * Usage:
 *   HEXABILL_OWNER_PASSWORD=... node scripts/phase7-viewport-matrix.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.HEXABILL_API || 'http://127.0.0.1:5000'
const FE = process.env.HEXABILL_FE || 'http://127.0.0.1:5173'
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret'
const PASS = process.env.HEXABILL_OWNER_PASSWORD || ''
const OUT = process.env.HEXABILL_EVIDENCE_DIR
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `phase7-matrix-${Date.now()}`)

const VIEWPORTS = ['360x800', '390x844', '768x1024', '1366x768', '1440x900']
const PAGES = [
  { id: 'pos', path: '/pos', pageId: 'pos' },
  { id: 'ledger', path: '/ledger', pageId: 'invoices' },
  { id: 'purchases', path: '/purchases', adminOnly: true },
  { id: 'suppliers', path: '/suppliers', adminOnly: true },
  { id: 'expenses', path: '/expenses', pageId: 'expenses' },
  { id: 'products', path: '/products', pageId: 'products' },
]
const TENANTS = ['frozenhub1', 'frozenhub2', 'gulfharvest', 'zayoga']
const ROLES = ['owner']

function loadOwners () {
  const dir = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'HexaBill_Backups')
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.startsWith('tier0-local-bootstrap-') && f.endsWith('.json')).sort()
    : []
  if (!files.length) return []
  const report = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
  return report.owners || []
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
  const token = json?.data?.token || json?.Data?.token
  if (!res.ok || !token) throw new Error(`${slug} login ${res.status}`)
  return token
}

async function feOk (route) {
  const res = await fetch(`${FE}${route}`, { redirect: 'follow' })
  const text = await res.text()
  const ok = res.ok && (text.includes('id="root"') || text.includes('vite') || text.includes('HexaBill'))
  return { ok, status: res.status, bytes: text.length }
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  fs.mkdirSync(OUT, { recursive: true })
  const owners = loadOwners()
  if (!owners.length) throw new Error('Run tier0-local-bootstrap.mjs first')

  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null)
  const fe = await feOk('/login')
  const report = {
    at: new Date().toISOString(),
    apiHealth: health,
    feLoginShell: fe,
    viewports: VIEWPORTS,
    roles: ROLES,
    cells: {},
    notes: [
      'Structure: API login + FE shell HTML reachability recorded here.',
      'Screenshot cells filled by Cursor browser CDP (see screenshots/ and VERDICT.md).',
      'Status values: planned | implemented | tested | blocked | not-run',
    ],
  }

  for (const tenant of TENANTS) {
    const owner = owners.find((o) => o.slug === tenant)
    if (!owner?.email) {
      for (const page of PAGES) {
        for (const vp of VIEWPORTS) {
          report.cells[`${tenant}|owner|${page.id}|${vp}`] = { status: 'blocked', reason: 'no owner email' }
        }
      }
      continue
    }
    let token
    try {
      token = await login(tenant, owner.email)
    } catch (e) {
      for (const page of PAGES) {
        for (const vp of VIEWPORTS) {
          report.cells[`${tenant}|owner|${page.id}|${vp}`] = { status: 'blocked', reason: String(e.message || e) }
        }
      }
      continue
    }

    for (const page of PAGES) {
      const html = await feOk(page.path)
      for (const vp of VIEWPORTS) {
        const key = `${tenant}|owner|${page.id}|${vp}`
        report.cells[key] = {
          status: token && html.ok ? 'implemented' : 'blocked',
          login: true,
          feShell: html,
          screenshot: 'not-run',
          structure: 'planned',
          matrix: 'section-10 partial — shell+auth only until screenshot attached',
        }
      }
      console.log(tenant, page.id, html.ok ? 'shell-ok' : 'shell-fail')
    }
  }

  const file = path.join(OUT, 'phase7-matrix.json')
  fs.writeFileSync(file, JSON.stringify(report, null, 2))
  console.log('Wrote', file)
  console.log('cells', Object.keys(report.cells).length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
