/**
 * Phase 7 viewport screenshots via Playwright (local only).
 * Usage:
 *   node scripts/phase7-capture-screens.mjs
 * Env: HEXABILL_FE, HEXABILL_EVIDENCE_DIR, HEXABILL_SESSION_JSON
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const FE = process.env.HEXABILL_FE || 'http://127.0.0.1:5173'
const OUT = process.env.HEXABILL_EVIDENCE_DIR
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', 'phase7-matrix-20261004-111213', 'screenshots')
const SESSION = process.env.HEXABILL_SESSION_JSON
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', 'phase7-matrix-20261004-111213', 'fh1.session.json')

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '1366x768', width: 1366, height: 768, mobile: false },
  { name: '1440x900', width: 1440, height: 900, mobile: false },
]
const PAGES = [
  { id: 'pos', path: '/pos' },
  { id: 'ledger', path: '/ledger' },
  { id: 'purchases', path: '/purchases' },
  { id: 'suppliers', path: '/suppliers' },
  { id: 'expenses', path: '/expenses' },
  { id: 'products', path: '/products' },
]

async function main () {
  if (!fs.existsSync(SESSION)) throw new Error(`Missing session ${SESSION}`)
  const { token, user } = JSON.parse(fs.readFileSync(SESSION, 'utf8'))
  if (!token || !user) throw new Error('session missing token/user')
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('hexabill_dev_tenant_host', 'frozenhub1.localhost')
    localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
  }, { token, user })

  const report = { at: new Date().toISOString(), out: OUT, cells: {} }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    for (const route of PAGES) {
      const key = `fh1-owner-${route.id}-${vp.name}`
      const file = path.join(OUT, `${key}.png`)
      try {
        await page.goto(`${FE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 })
        await page.waitForTimeout(800)
        // Expenses: open category bars when present
        if (route.id === 'expenses') {
          const tab = page.getByRole('tab', { name: /By category/i })
          if (await tab.count()) {
            await tab.first().click().catch(() => {})
            await page.waitForTimeout(300)
          }
        }
        await page.screenshot({ path: file, fullPage: false })
        report.cells[key] = { status: 'captured', bytes: fs.statSync(file).size }
        console.log('OK', key, fs.statSync(file).size)
      } catch (e) {
        report.cells[key] = { status: 'fail', error: String(e.message || e) }
        console.error('FAIL', key, e.message || e)
      }
    }
  }

  await browser.close()
  const reportPath = path.join(path.dirname(OUT), 'phase7-screens-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
