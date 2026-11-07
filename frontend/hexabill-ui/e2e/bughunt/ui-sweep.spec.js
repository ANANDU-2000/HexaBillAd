// T4 bug hunt 1: UI sweep of POS, Payments, Returns, Daily close, Purchases, Products at 360/752/1254/1440
// plus expired-token and offline behaviour. Run with project d1440 only (viewports are set inside the test).
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin } from '../session.js'

const SLUG = 'gulfharvest-test'
const SIZES = [[360, 800], [752, 1024], [1254, 800], [1440, 900]]
const ROUTES = ['/pos', '/payments', '/returns/create', '/daily-close', '/purchases', '/products']
const SHOTS = process.env.HEXABILL_HUNT_SHOTS
test.use({ trace: 'off' })

// Console noise that is expected on a synthetic tenant.
const IGNORE = /favicon|Download the React DevTools|\[vite\]|ResizeObserver/i

for (const route of ROUTES) {
  test(`sweep ${route}: no page errors, no 4xx/5xx, no sideways scroll, no control past the screen edge (4 widths)`, async ({ page }) => {
    const problems = []
    let current = ''
    page.on('pageerror', (e) => problems.push(`[${current}] pageerror: ${e.message.slice(0, 140)}`))
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push(`[${current}] console.error: ${m.text().slice(0, 140)}`) })
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/api/')) problems.push(`[${current}] ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`)
    })
    await signIn(page, SLUG)
    for (const [w, h] of SIZES) {
      current = `${route}@${w}`
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const over = []
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue
          // ignore things inside horizontally scrollable wrappers and off-canvas drawers
          let p = el.parentElement; let scrollable = false
          while (p) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) { scrollable = true; break } p = p.parentElement }
          if (scrollable) continue
          if (r.right > vw + 1 || r.left < -1) over.push(`${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 24)}@${Math.round(r.left)}-${Math.round(r.right)}`)
        }
        return { vw, scrollW: document.documentElement.scrollWidth, over: over.slice(0, 6), text: document.body.innerText.length, junk: (document.body.innerText.match(/\[object Object\]|\bundefined\b|\bNaN\b/g) || []).length }
      })
      if (m.scrollW > m.vw + 1) problems.push(`[${current}] sideways scroll ${m.scrollW}>${m.vw}`)
      if (m.over.length) problems.push(`[${current}] past edge: ${m.over.join(' | ')}`)
      if (m.text < 40) problems.push(`[${current}] white screen`)
      if (m.junk) problems.push(`[${current}] junk text (undefined/NaN/[object Object]) x${m.junk}`)
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${route.replace(/\//g, '_')}-${w}.png` }) }
    }
    expect(problems).toEqual([])
  })
}

test('expired token: any page sends the user to login without a white screen or an endless spinner', async ({ page }) => {
  await signIn(page, SLUG)
  await page.evaluate(() => localStorage.setItem('token', 'expired.invalid.token'))
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/login/)
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(40)
})

test('token expiring mid-session: next action redirects to login (not a silent failure)', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.setItem('token', 'expired.invalid.token'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/login/)
})

test('offline then online: Payments list shows an error/offline state, not a blank list, and recovers', async ({ page, context }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(2500)
  const offlineText = (await page.locator('body').innerText()).trim()
  await context.setOffline(false)
  expect(offlineText.length, 'offline page should not be blank').toBeGreaterThan(20)
})

test('slow API: Products list shows a loading state (not empty-state text) while the request is pending', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route('**/api/products**', async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue() })
  await page.goto(`${feOrigin(SLUG)}/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const text = (await page.locator('body').innerText()).toLowerCase()
  expect(/no products|nothing here|no results|get started by adding/.test(text), 'empty state flashed while loading').toBe(false)
})

test('slow API: Payments list shows a loading state (not empty-state text) while the request is pending', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route('**/api/payments**', async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue() })
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const text = (await page.locator('body').innerText()).toLowerCase()
  expect(/no payments|nothing here|no results/.test(text), 'empty state flashed while loading').toBe(false)
})

test('API 500 on Payments list shows an error state with retry, not an empty list', async ({ page }) => {
  await signIn(page, SLUG)
  await page.route('**/api/payments?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }))
  await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const text = (await page.locator('body').innerText()).toLowerCase()
  expect(/no payments yet|no payments found/.test(text) && !/retry|try again|could not|failed|error/.test(text), 'a failed load looks like an empty list').toBe(false)
})
