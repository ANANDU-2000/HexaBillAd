/**
 * §10 Visual: Arabic RTL shell smoke (dir=rtl, non-blank, no horizontal overflow).
 * Requires API:5000 + Vite:5173 + HEXABILL_OWNER_PASSWORD.
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
const OUT = process.env.HEXABILL_RTL_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `rtl-shell-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`)

const PAGES = (process.env.HEXABILL_PAGES || 'dashboard:/dashboard,customers:/customers,products:/products,purchases:/purchases,expenses:/expenses,ledger:/ledger,billing:/billing-history,reports:/reports,profile:/profile')
  .split(',')
  .map((s) => {
    const [id, p] = s.split(':')
    return { id: id.trim(), path: (p || '/').trim() }
  })

const VIEWPORTS = (process.env.HEXABILL_VIEWPORTS || '360x800,1440x900')
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number)
    return { id: s.trim(), w, h }
  })

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
      languagePreference: 'ar',
    },
  }
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const owner = loadOwner('frozenhub1')
  if (!owner) throw new Error('No FH1 bootstrap owner')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

  const session = await login(owner.slug, owner.email)
  const browser = await chromium.launch({ headless: true })
  const report = { at: new Date().toISOString(), out: OUT, lang: 'ar', cells: {}, summary: { ok: 0, fail: 0, warn: 0 } }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
    const page = await context.newPage()
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user, slug }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('hexabill_lang', 'ar')
      localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
      localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
      document.documentElement.lang = 'ar'
      document.documentElement.dir = 'rtl'
    }, { token: session.token, user: session.user, slug: owner.slug })

    for (const p of PAGES) {
      const key = `fh1-owner-ar-${p.id}-${vp.id}`
      const file = path.join(OUT, 'screenshots', `${key}.png`)
      const cell = { path: p.path, viewport: vp.id, checks: {} }
      try {
        await page.goto(`${FE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(800)
        await page.keyboard.press('Escape').catch(() => {})
        // Re-assert RTL in case a navigation reset it before main.jsx boot ran
        await page.evaluate(() => {
          localStorage.setItem('hexabill_lang', 'ar')
          document.documentElement.lang = 'ar'
          document.documentElement.dir = 'rtl'
        })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(600)
        await page.keyboard.press('Escape').catch(() => {})

        const meta = await page.evaluate(() => {
          const root = document.documentElement
          const body = document.body
          const overflowX = Math.max(body.scrollWidth, root.scrollWidth) > Math.max(body.clientWidth, root.clientWidth) + 2
          const text = (body.innerText || '').trim()
          return {
            dir: root.getAttribute('dir') || root.dir || '',
            lang: root.getAttribute('lang') || root.lang || '',
            overflowX,
            textLen: text.length,
          }
        })
        cell.checks.dirRtl = meta.dir === 'rtl'
        cell.checks.langAr = meta.lang === 'ar' || meta.lang.startsWith('ar')
        cell.checks.overflowX = meta.overflowX
        cell.checks.blank = meta.textLen < 20
        cell.checks.hasBodyText = meta.textLen >= 20

        await page.screenshot({ path: file, fullPage: false })
        cell.bytes = fs.statSync(file).size
        const fail = cell.checks.blank || !cell.checks.dirRtl
        cell.warn = cell.checks.overflowX === true
        cell.status = fail ? 'fail' : 'captured'
        if (fail) report.summary.fail++
        else report.summary.ok++
        if (cell.warn) report.summary.warn++
        console.log(cell.status === 'captured' ? 'OK' : 'FAIL', key, JSON.stringify(cell.checks))
      } catch (e) {
        cell.status = 'fail'
        cell.error = String(e.message || e)
        report.summary.fail++
        console.error('FAIL', key, e.message || e)
      }
      report.cells[key] = cell
    }
    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'rtl-shell-report.json'), JSON.stringify(report, null, 2))
  console.log('Wrote', path.join(OUT, 'rtl-shell-report.json'), JSON.stringify(report.summary))
  if (report.summary.fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
