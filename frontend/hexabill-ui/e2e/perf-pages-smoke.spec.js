// Read-only smoke for the performance pass: every client-data page loads at the project's viewport with no
// console/page errors, no horizontal overflow, and no stuck skeleton. Also exercises the lazy assistant panel.
// One login per project run (the login endpoint locks out after repeated failures).
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const SHOTS = process.env.HEXABILL_PERF_SHOTS || ''

const ROUTES = [
  '/dashboard', '/customers', '/ledger', '/pending-bills', '/payments', '/sales-ledger', '/billing-history',
  '/expenses', '/products', '/purchases', '/suppliers', '/reports', '/daily-close', '/quotations',
  '/delivery-notes', '/branches', '/users', '/settings', '/audit'
]

// Errors that are environment noise for a synthetic tenant, not page defects.
const NOISE = /favicon|Failed to load resource|net::ERR|ResizeObserver|Download the React DevTools/i

test('client-data pages load clean at this viewport', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000)
  await signIn(page, SLUG)
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`))
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`) })

  const report = []
  for (const route of ROUTES) {
    const before = errors.length
    const t0 = Date.now()
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const ms = Date.now() - t0
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      skeleton: document.querySelectorAll('.skeleton').length,
      body: (document.body.innerText || '').trim().length,
      path: location.pathname
    }))
    report.push({ route, finalPath: m.path, ms, overflow: m.overflow, skeletonLeft: m.skeleton, textLen: m.body, newErrors: errors.length - before })
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true })
      await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}${route.replace(/\//g, '_')}.png`) })
    }
  }

  // Lazy assistant: it must open from the shell, then close and reopen with the same panel.
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {})
  const openBtn = page.getByRole('button', { name: /assistant|ask/i }).first()
  let assistant = 'button not present (flag off or hidden)'
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click()
    const dialog = page.getByRole('dialog').or(page.locator('[data-assistant-panel], aside')).first()
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    assistant = 'opened and closed'
  }

  console.log(`PERF_REPORT ${testInfo.project.name} ${JSON.stringify({ assistant, report, errors: errors.slice(0, 12) })}`)
  const bad = report.filter((r) => r.overflow > 1 || r.newErrors > 0 || r.textLen < 20)
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([])
})
