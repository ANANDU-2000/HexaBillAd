/**
 * Tier0 browser-print live evidence (MASTER-LOOP §5 gate 2 remainder).
 * FH1 owner: Billing History → InvoicePreview → Print options + PDF download.
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
const OUT = process.env.HEXABILL_BROWSER_PRINT_OUT
  || path.join(process.env.USERPROFILE || '.', 'Desktop', 'HexaBill_Backups', `browser-print-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`)

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

async function apiGetBin (slug, token, urlPath) {
  const res = await fetch(`${API}${urlPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
    },
  })
  const buf = Buffer.from(await res.arrayBuffer())
  return { ok: res.ok, status: res.status, buf, contentType: res.headers.get('content-type') || '' }
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

function latin1Has (buf, needle) {
  return Buffer.from(buf).toString('latin1').includes(needle)
}

async function main () {
  if (!PASS) throw new Error('Set HEXABILL_OWNER_PASSWORD')
  const owner = loadOwner('frozenhub1')
  if (!owner) throw new Error('No frozenhub1 bootstrap owner')
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'pdf'), { recursive: true })

  const session = await login(owner.slug, owner.email)
  const sales = await apiGet(owner.slug, session.token, '/api/sales?page=1&pageSize=5')
  const saleId = firstId(sales.json)
  if (!saleId) throw new Error('No sale to print')

  const pdfRes = await apiGetBin(owner.slug, session.token, `/api/sales/${saleId}/pdf?format=a4`)
  const apiPdfPath = path.join(OUT, 'pdf', `sale-${saleId}-a4-api.pdf`)
  if (pdfRes.ok && pdfRes.buf?.length) fs.writeFileSync(apiPdfPath, pdfRes.buf)

  const report = {
    at: new Date().toISOString(),
    out: OUT,
    slug: owner.slug,
    saleId,
    apiPdf: {
      ok: pdfRes.ok,
      status: pdfRes.status,
      bytes: pdfRes.buf?.length || 0,
      contentType: pdfRes.contentType,
      hasSampleInvoice: pdfRes.buf ? latin1Has(pdfRes.buf, 'SAMPLE INVOICE') : false,
      hasInvoiceWord: pdfRes.buf ? /\bINVOICE\b/i.test(Buffer.from(pdfRes.buf).toString('latin1')) : false,
      path: apiPdfPath,
    },
    browser: {},
  }

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      acceptDownloads: true,
      extraHTTPHeaders: {
        'X-HexaBill-Original-Host': `${owner.slug}.localhost`,
        'X-HexaBill-Edge-Secret': EDGE,
      },
    })
    const page = await context.newPage()
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, { token: session.token, user: session.user })

    await page.goto(`${FE}/billing-history`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    // Dismiss auto-open notifications / overlays that steal clicks
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      const close = [...document.querySelectorAll('button')].find((b) => /close|dismiss/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')))
      close?.click()
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, 'screenshots', '01-billing-history.png'), fullPage: true })

    // Row action: eye (view) then Print Invoice, or direct printer icon on first data row
    const opened = await page.evaluate(() => {
      const row = document.querySelector('tbody tr')
      if (!row) return null
      const btns = [...row.querySelectorAll('button')]
      const view = btns.find((b) => /view|preview/i.test((b.getAttribute('title') || '') + (b.getAttribute('aria-label') || '')))
      if (view) { view.click(); return 'row-view' }
      const print = btns.find((b) => /print/i.test((b.getAttribute('title') || '') + (b.getAttribute('aria-label') || '')))
      if (print) { print.click(); return 'row-print' }
      return null
    })
    report.browser.openAction = opened
    await page.waitForTimeout(1500)

    // Prefer Print inside invoice preview dialog (avoid shell "Print this page")
    const printInDialog = page.getByTitle(/print invoice/i).or(page.getByRole('button', { name: /^print$/i })).first()
    if (await printInDialog.count()) {
      await printInDialog.click({ force: true, timeout: 10000 })
      await page.waitForTimeout(800)
      report.browser.printClicked = true
    } else {
      report.browser.printClicked = false
    }
    await page.emulateMedia({ media: 'print' })
    await page.screenshot({ path: path.join(OUT, 'screenshots', '02-print-options-print-media.png'), fullPage: true })
    await page.emulateMedia({ media: 'screen' })
    await page.screenshot({ path: path.join(OUT, 'screenshots', '03-print-options-screen.png'), fullPage: true })

    // Download PDF from preview Download button if present
    let downloadBytes = 0
    const downloadBtn = page.getByRole('button', { name: /download/i }).first()
    if (await downloadBtn.count()) {
      try {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20000 }),
          downloadBtn.click(),
        ])
        const dlPath = path.join(OUT, 'pdf', await download.suggestedFilename())
        await download.saveAs(dlPath)
        downloadBytes = fs.statSync(dlPath).size
        report.browser.download = { path: dlPath, bytes: downloadBytes, suggested: download.suggestedFilename() }
      } catch (e) {
        report.browser.downloadError = String(e.message || e)
      }
    }

    // Settings company header preview (browser chrome print surface)
    await page.goto(`${FE}/settings`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    const previewHeader = page.getByRole('button', { name: /preview/i }).first()
    if (await previewHeader.count()) {
      try {
        await previewHeader.click({ force: true, timeout: 8000 })
        await page.waitForTimeout(600)
        await page.emulateMedia({ media: 'print' })
        await page.screenshot({ path: path.join(OUT, 'screenshots', '04-settings-header-print-media.png'), fullPage: true })
        report.browser.settingsHeaderPreview = true
      } catch (e) {
        report.browser.settingsHeaderPreview = false
        report.browser.settingsPreviewError = String(e.message || e)
        await page.screenshot({ path: path.join(OUT, 'screenshots', '04-settings-preview-fail.png'), fullPage: true })
      }
    } else {
      report.browser.settingsHeaderPreview = false
      await page.screenshot({ path: path.join(OUT, 'screenshots', '04-settings-no-preview-btn.png'), fullPage: true })
    }

    report.browser.screenshots = fs.readdirSync(path.join(OUT, 'screenshots'))
    const printShot = path.join(OUT, 'screenshots', '03-print-options-screen.png')
    const printShotBytes = fs.existsSync(printShot) ? fs.statSync(printShot).size : 0
    report.ok = !!(
      report.apiPdf.ok
      && report.apiPdf.bytes > 5000
      && report.browser.printClicked
      && printShotBytes > 20000
    )
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    ok: report.ok,
    saleId,
    apiBytes: report.apiPdf.bytes,
    sample: report.apiPdf.hasSampleInvoice,
    openAction: report.browser.openAction,
    downloadBytes: report.browser.download?.bytes || 0,
    shots: report.browser.screenshots?.length || 0,
    out: OUT,
  }, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
