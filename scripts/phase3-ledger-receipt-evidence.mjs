/**
 * Slice 3/4 evidence: ledger 5 viewports + receipt reprint HAR (no double POST).
 * FH1 owner; requires API:5000 + Vite:5173 + HEXABILL_OWNER_PASSWORD.
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
const OUT = process.env.HEXABILL_LEDGER_RECEIPT_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `ledger-receipt-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`)

const VPS = [
  { id: '360x800', w: 360, h: 800 },
  { id: '390x844', w: 390, h: 844 },
  { id: '768x1024', w: 768, h: 1024 },
  { id: '1366x768', w: 1366, h: 768 },
  { id: '1440x900', w: 1440, h: 900 },
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

async function apiGet (slug, token, urlPath) {
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

function firstId (json) {
  const d = json?.data || json?.Data
  const items = d?.items || d?.Items || (Array.isArray(d) ? d : null)
  if (!Array.isArray(items) || !items.length) return null
  return items[0].id ?? items[0].Id ?? null
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const owner = loadOwner('frozenhub1')
  if (!owner) throw new Error('No frozenhub1 bootstrap owner')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'har'), { recursive: true })

  const session = await login(owner.slug, owner.email)
  const cust = await apiGet(owner.slug, session.token, '/api/customers?page=1&pageSize=5')
  const customerId = firstId(cust.json)
  const pays = await apiGet(owner.slug, session.token, customerId
    ? `/api/customers/${customerId}/payments?page=1&pageSize=5`
    : '/api/payments?page=1&pageSize=5')
  let paymentId = firstId(pays.json)
  if (!paymentId) {
    const all = await apiGet(owner.slug, session.token, '/api/payments?page=1&pageSize=5')
    paymentId = firstId(all.json)
  }

  const browser = await chromium.launch({ headless: true })
  const report = {
    at: new Date().toISOString(),
    out: OUT,
    slug: owner.slug,
    customerId,
    paymentId,
    ledger: {},
    receipt: {},
  }

  // Ledger 5VP shells
  for (const vp of VPS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
    const page = await context.newPage()
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user, slug }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
      localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
    }, { token: session.token, user: session.user, slug: owner.slug })
    const paths = ['/ledger', '/sales-ledger']
    for (const p of paths) {
      const key = `fh1-owner-${p.replace(/\//g, '_')}-${vp.id}`
      const file = path.join(OUT, 'screenshots', `${key}.png`)
      try {
        await page.goto(`${FE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(600)
        const text = await page.locator('body').innerText().catch(() => '')
        const blank = text.trim().length < 20
        await page.screenshot({ path: file, fullPage: false })
        report.ledger[key] = { status: blank ? 'fail' : 'captured', path: p, blank, bytes: fs.statSync(file).size }
        console.log(report.ledger[key].status === 'captured' ? 'OK' : 'FAIL', key)
      } catch (e) {
        report.ledger[key] = { status: 'fail', path: p, error: String(e.message || e) }
        console.error('FAIL', key, e.message || e)
      }
    }
    await context.close()
  }

  // Receipt reprint HAR: open receipt twice; count POST /receipts
  const harPath = path.join(OUT, 'har', 'receipt-reprint.har')
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordHar: { path: harPath, content: 'omit' },
  })
  const page = await context.newPage()
  const posts = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && /receipt/i.test(req.url())) posts.push({ url: req.url(), ts: Date.now() })
  })
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user, slug }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('hexabill_dev_tenant_host', `${slug}.localhost`)
    localStorage.setItem('hexabill_dev_edge_secret', 'dev-local-edge-secret')
  }, { token: session.token, user: session.user, slug: owner.slug })

  const receiptPaths = []
  if (paymentId) receiptPaths.push(`/receipts/${paymentId}`)
  if (customerId) receiptPaths.push(`/customers/${customerId}`)
  receiptPaths.push('/billing-history')

  for (const p of receiptPaths) {
    try {
      await page.goto(`${FE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(500)
      // try common reprint / receipt buttons without forcing create
      const btn = page.getByRole('button', { name: /reprint|receipt|print|pdf/i }).first()
      if (await btn.count()) {
        await btn.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(800)
        // second click — should not create a second POST if reprint-safe
        await btn.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(800)
      }
      const shot = path.join(OUT, 'screenshots', `fh1-receipt-${p.replace(/\//g, '_')}.png`)
      await page.screenshot({ path: shot, fullPage: false })
      report.receipt[p] = { screenshot: shot, postsSoFar: posts.length }
    } catch (e) {
      report.receipt[p] = { error: String(e.message || e), postsSoFar: posts.length }
    }
  }

  await context.close()
  await browser.close()

  report.receiptPostCount = posts.length
  report.receiptPosts = posts
  report.summary = {
    ledgerOk: Object.values(report.ledger).filter((c) => c.status === 'captured').length,
    ledgerFail: Object.values(report.ledger).filter((c) => c.status !== 'captured').length,
    receiptPosts: posts.length,
    // reprint path should not spam POSTs; 0-1 acceptable depending on UI generate-once
    reprintSafe: posts.length <= 1,
  }
  const reportPath = path.join(OUT, 'ledger-receipt-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log('Wrote', reportPath, JSON.stringify(report.summary))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
