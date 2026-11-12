// T4 hunt 2: Admin role UI sweep of money, documents, route and settings pages at 360/752/1254/1440.
// Creates one Admin user and removes it afterwards (the synthetic seed refuses password rotation with extra users).
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE, feOrigin } from '../session.js'

const SLUG = 'gulfharvest-test'
const SIZES = [[360, 800], [752, 1024], [1254, 800], [1440, 900]]
const ROUTES = ['/dashboard', '/billing-history', '/sales-ledger', '/ledger', '/vat-return', '/reports', '/worksheet', '/expenses', '/suppliers',
  '/stock-adjustments', '/delivery-notes', '/quotations', '/agreements', '/salary-certificates', '/branches', '/routes', '/users', '/settings', '/backup', '/audit', '/pricelist']
const IGNORE = /favicon|DevTools|\[vite\]|ResizeObserver/i
test.use({ trace: 'off' })
const H = { 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }
let owner; let adminId; let session

test.beforeAll(async () => {
  owner = await apiLogin(SLUG)
  const email = `hunt-admin2-${Date.now()}@gulfharvest-test.hexabill.local`; const password = 'HuntAdm-2026!x'
  const c = await fetch(`${API}/api/users`, { method: 'POST', headers: { ...H, Authorization: `Bearer ${owner.token}` }, body: JSON.stringify({ name: 'Hunt Admin2', email, password, role: 'Admin' }) })
  const cj = await c.json(); if (!c.ok) throw new Error(`create admin ${c.status} ${JSON.stringify(cj).slice(0, 160)}`)
  adminId = cj.data?.userId ?? cj.data?.id ?? cj.data?.Id
  const l = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email, password }) })).json()
  const d = l.data
  session = { token: d.token, user: { id: d.userId, role: d.role, name: d.name, companyName: d.companyName, tenantId: d.tenantId, pageAccess: d.pageAccess ?? null, dashboardPermissions: d.dashboardPermissions ?? null, assignedBranchIds: [], assignedRouteIds: [], mustChangePassword: false } }
})
test.afterAll(async () => { if (adminId) await fetch(`${API}/api/users/${adminId}`, { method: 'DELETE', headers: { ...H, Authorization: `Bearer ${owner.token}` } }) })

for (const route of ROUTES) {
  test(`admin sweep ${route}`, async ({ page }) => {
    const problems = []; let cur = ''
    page.on('pageerror', (e) => problems.push(`[${cur}] pageerror ${e.message.slice(0, 120)}`))
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push(`[${cur}] console ${m.text().slice(0, 120)}`) })
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) problems.push(`[${cur}] ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
    await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)) }, session)
    for (const [w, h] of SIZES) {
      cur = `${route}@${w}`
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth; const over = []
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
          if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue
          let p = el.parentElement; let sc = false
          while (p) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) { sc = true; break } p = p.parentElement }
          if (sc) continue
          if (r.right > vw + 1 || r.left < -1) over.push(`${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20)}@${Math.round(r.left)}-${Math.round(r.right)}`)
        }
        const t = document.body.innerText
        return { vw, sw: document.documentElement.scrollWidth, over: over.slice(0, 5), len: t.length, junk: (t.match(/\[object Object\]|\bundefined\b|\bNaN\b/g) || []).length, url: location.pathname }
      })
      // /worksheet is owner-only and /routes is an alias of /branches: those redirects are by design.
      if (!['/worksheet', '/routes'].includes(route) && m.url !== route && !m.url.startsWith(route)) problems.push(`[${cur}] redirected to ${m.url}`)
      if (m.sw > m.vw + 1) problems.push(`[${cur}] sideways scroll ${m.sw}>${m.vw}`)
      if (m.over.length) problems.push(`[${cur}] past edge ${m.over.join(' | ')}`)
      if (m.len < 40) problems.push(`[${cur}] white screen`)
      if (m.junk) problems.push(`[${cur}] junk text x${m.junk}`)
    }
    expect(problems).toEqual([])
  })
}
