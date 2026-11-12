// Whole-app UI/UX audit (read-only). One JSON file per viewport project in ui-audit/.
import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { signIn, feOrigin } from './session.js'

test.use({ hasTouch: process.env.HEXABILL_AUDIT_TOUCH === '1' }) // tablets are touch devices: 16px root (see index.css)
const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const ROUTES = (process.env.HEXABILL_AUDIT_ROUTES ? process.env.HEXABILL_AUDIT_ROUTES.split(',').map((r) => (r.startsWith('/') ? r : '/' + r)) : ['/dashboard', '/pos', '/billing-history', '/sales-ledger', '/ledger', '/payments', '/purchases', '/expenses',
  '/customers', '/products', '/suppliers', '/branches', '/routes', '/pricelist', '/reports', '/reports/outstanding', '/daily-close',
  '/vat-return', '/worksheet', '/profit-history', '/users', '/settings', '/profile', '/backup', '/audit', '/help', '/more',
  '/documents', '/quotations', '/agreements', '/salary-certificates', '/delivery-notes', '/recurring-invoices',
  '/stock-adjustments', '/pending-bills', '/returns/create', '/route-map', '/my-routes', '/feedback', '/legacy/invoices'])

const measure = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c } return { r: 255, g: 255, b: 255, a: 1 } }
  const out = { smallText12: 0, smallText14: 0, lowContrast: 0, caps: 0, ellipsis: 0, tapSmall: 0, unnamed: 0, unlabeledInputs: 0, nestedScroll: 0, hoverOnly: 0, samples: {} }
  const note = (k, el) => { (out.samples[k] ||= []).length < (k === 'tapSmall' ? 40 : 3) && out.samples[k].push((el.tagName + '.' + String(el.className).split(' ').slice(0, 3).join('.') + ' "' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '" ' + (el.getAttribute('data-sz') || ''))) }
  const all = [...document.querySelectorAll('body *')].filter(vis).slice(0, 2500)
  for (const el of all) {
    const s = getComputedStyle(el)
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (own) {
      const fs = parseFloat(s.fontSize)
      if (fs < 12) { out.smallText12++; note('smallText12', el) } else if (fs < 14) out.smallText14++
      if (s.textTransform === 'uppercase') out.caps++
      const fg = parse(s.color); const bg = bgOf(el)
      if (fg) { const a = lum(fg) , b = lum(bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); const need = fs >= 18.66 || (fs >= 14 && +s.fontWeight >= 700) ? 3 : 4.5; if (cr < need) { out.lowContrast++; note('lowContrast', el) } }
      if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) { out.ellipsis++; note('ellipsis', el) }
    }
    if (el.matches('button,a[href],select,input:not([type=hidden]),[role=button],[role=tab]')) {
      const r = el.getBoundingClientRect()
      if (el.classList.contains('sr-only')) continue
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
      if (!inline && (r.height < 44 || r.width < 44) && !(el.type === 'checkbox' || el.type === 'radio')) { out.tapSmall++; el.setAttribute('data-sz', Math.round(r.width) + 'x' + Math.round(r.height)); note('tapSmall', el) }
      if (el.matches('button,a[href],[role=button]') && !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.querySelector('img[alt]')) { out.unnamed++; note('unnamed', el) }
      if (el.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.id && !el.closest('label')) { out.unlabeledInputs++; note('unlabeledInputs', el) }
    }
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el !== document.scrollingElement) { out.nestedScroll++; note('nestedScroll', el) }
  }
  out.overflowX = document.documentElement.scrollWidth - window.innerWidth
  out.h1 = (document.querySelector('h1')?.innerText || '').trim().slice(0, 50)
  out.pageHeight = document.documentElement.scrollHeight
  out.textLen = (document.body.innerText || '').length
  return out
}

test('audit all routes', async ({ page }, info) => {
  test.setTimeout(900000)
  await signIn(page, SLUG)
  mkdirSync('ui-audit', { recursive: true })
  const results = []
  for (const route of ROUTES) {
    const errors = []; const failed = []
    const onC = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)) }
    const onR = (r) => { if (r.status() >= 400 && !r.url().includes('/favicon')) failed.push(`${r.status()} ${new URL(r.url()).pathname}`.slice(0, 90)) }
    page.on('console', onC); page.on('response', onR)
    const t0 = Date.now()
    let m = { error: 'navigation failed' }
    try {
      await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(500)
      m = await page.evaluate(measure)
      const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
      await page.screenshot({ path: `ui-audit/${info.project.name}-${name}.png`, fullPage: true })
      m.finalPath = new URL(page.url()).pathname
    } catch (e) { m.error = String(e.message).slice(0, 120) }
    m.route = route; m.loadMs = Date.now() - t0; m.consoleErrors = [...new Set(errors)].slice(0, 4); m.failedRequests = [...new Set(failed)].slice(0, 4)
    page.off('console', onC); page.off('response', onR)
    results.push(m)
  }
  writeFileSync(`ui-audit/${info.project.name}.json`, JSON.stringify(results, null, 1))
})
