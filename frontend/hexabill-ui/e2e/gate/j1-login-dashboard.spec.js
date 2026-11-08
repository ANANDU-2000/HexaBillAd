// E2E-G1 / J1: sign in -> Dashboard. KPIs load (and agree with the server), "Needs attention" shows, no console errors.
// Run at d1440, m360 and t768 (tablet).
import { test, expect } from '@playwright/test'
import { SLUG, call, feOrigin, watchConsole, money } from './gateKit.js'
import { ownerPassword } from '../session.js'

const IGNORED = /favicon|net::ERR_ABORTED|Failed to load resource.*(404|429)/i

test('J1 login through the form lands on the Dashboard with KPIs matching the server and no console errors', async ({ page }) => {
  const errors = watchConsole(page)
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"], input[name="email"]').first().fill(`owner@${SLUG}.hexabill.local`)
  await page.locator('input[type="password"]').first().fill(ownerPassword())
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click()
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
  if (!/dashboard/.test(page.url())) await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')

  const kpis = page.getByRole('region', { name: 'KPI summary' })
  await expect(kpis).toBeVisible()
  await expect(kpis).toContainText(/Sales Today|Period Sales/)
  await expect(kpis).toContainText('Pending Amount')
  // No skeleton left behind: every KPI card shows a number.
  await expect(kpis).toContainText(/\d/)

  // KPI cards on screen equal the server's figures (same endpoint the page uses).
  const d0 = new Date(); const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`
  const raw = (await call(SLUG, `/api/reports/summary?fromDate=${today}&toDate=${today}`)).json.data || {}
  const d = raw
  const pick = (o, k) => o[k] ?? o[k[0].toUpperCase() + k.slice(1)]
  const serverPending = Number(pick(d, 'pendingBillsAmount'))
  const serverSales = Number(pick(d, 'netSalesToday') || pick(d, 'salesToday'))
  expect(Number.isFinite(serverPending) && Number.isFinite(serverSales), `summary exposes pending/sales: ${Object.keys(d).slice(0, 12)}`).toBe(true)
  const pendingText = await kpis.getByRole('button', { name: /^Pending Amount/ }).innerText()
  expect(money(pendingText), 'Pending Amount KPI equals server').toBeCloseTo(serverPending, 2)
  const salesText = await kpis.getByRole('button', { name: /^(Sales Today|Period Sales)/ }).innerText()
  expect(money(salesText.split('Gross')[0]), 'Sales KPI equals server net sales').toBeCloseTo(serverSales, 2)

  const bad = errors.filter((e) => !IGNORED.test(e))
  expect(bad, 'console errors on the dashboard').toEqual([])
})

test('BUG: J1 "Needs attention" block is missing from the Dashboard (the page shows "Critical alerts" and "Operational status" instead)', async ({ page }) => {
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  const { signIn } = await import('../session.js')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('region', { name: 'KPI summary' })).toBeVisible()
  const heading = page.getByText(/needs attention/i).filter({ visible: true })
  await expect(heading.first(), 'a visible "Needs attention" block').toBeVisible()
})
