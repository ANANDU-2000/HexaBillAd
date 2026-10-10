/* eslint-env node */
// Stage 3 UX checks against local tenants only (never production).
//  UX-1 workflow: create a customer through the UI, then confirm it exists via the API (not by screenshot).
//  UX-4 keyboard: Ctrl/Cmd+K palette, "?" shortcut help, Esc, Ctrl+\ sidebar collapse.
//  UX-6 tenant branding and isolation: each tenant sees only its own name; a token from one tenant
//       is refused on another tenant's host.
import { test, expect } from '@playwright/test'
import { API, EDGE, TENANTS, ownerPassword, signIn, feOrigin, apiLogin } from './session.js'

test.skip(!ownerPassword(), 'Set HEXABILL_OWNER_PASSWORD or e2e/.env.local')

const apiGet = async (slug, path, token) => {
  const res = await fetch(`${API}/api${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
    },
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test.describe('UX-1 create customer (UI) and verify via API', () => {
  test('customer saved from the form is returned by the API', async ({ page }, info) => {
    test.setTimeout(120_000)
    const slug = 'gulfharvest'
    const { token } = await signIn(page, slug)
    const name = `UX Test ${info.project.name} ${Date.now()}`
    await page.goto(`${feOrigin(slug)}/customers`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /add customer/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Customer Name').fill(name)
    await dialog.getByLabel('Phone Number').fill(`05${String(Date.now()).slice(-8)}`)
    const branch = dialog.getByLabel(/^Branch/)
    const branchOptions = await branch.locator('option').count()
    if (branchOptions > 1) {
      // A required field left empty must explain itself instead of silently blocking the save.
      await dialog.getByRole('button', { name: /^add customer$/i }).click()
      await expect(dialog.getByRole('alert').filter({ hasText: /branch is required/i })).toBeVisible()
      await branch.selectOption({ index: 1 })
      const route = dialog.getByLabel(/^Route/)
      if (await route.locator('option').count() > 1) {
        await dialog.getByRole('button', { name: /^add customer$/i }).click()
        await expect(dialog.getByRole('alert').filter({ hasText: /route is required/i })).toBeVisible()
        await route.selectOption({ index: 1 })
      }
    }
    await dialog.getByRole('button', { name: /^add customer$/i }).click()
    await expect(dialog).toBeHidden({ timeout: 15_000 })

    const { status, json } = await apiGet(slug, `/customers/search?q=${encodeURIComponent(name)}&limit=5`, token)
    expect(status).toBe(200)
    const rows = json?.data?.items || json?.data || json?.Data || []
    expect(JSON.stringify(rows)).toContain(name)
    // The new row is visible on the page without a manual refresh.
    await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('UX-4 keyboard', () => {
  test('palette, shortcut help and sidebar collapse', async ({ page }) => {
    const width = page.viewportSize().width
    test.skip(width < 1024, 'desktop keyboard shortcuts')
    const slug = 'gulfharvest'
    await signIn(page, slug)
    await page.goto(`${feOrigin(slug)}/dashboard`, { waitUntil: 'networkidle' })

    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog').filter({ has: page.locator('input') }).first()
    await expect(palette).toBeVisible()
    await page.keyboard.type('custom')
    await expect(page.getByRole('option').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    await page.locator('body').click({ position: { x: width - 20, y: 300 } })
    await page.keyboard.press('Shift+?')
    await expect(page.getByRole('dialog').filter({ hasText: /shortcut/i }).first()).toBeVisible()
    await page.keyboard.press('Escape')

    const sidebar = page.getByRole('navigation', { name: 'Main' })
    const before = (await sidebar.boundingBox()).width
    await page.keyboard.press('Control+Backslash')
    await expect.poll(async () => (await sidebar.boundingBox()).width).not.toBe(before)
    await page.keyboard.press('Control+Backslash')
  })
})

test.describe('UX-6 tenant branding and isolation', () => {
  for (const slug of TENANTS) {
    test(`${slug}: own identity only`, async ({ page }) => {
      const { token } = await signIn(page, slug)
      await page.goto(`${feOrigin(slug)}/dashboard`, { waitUntil: 'networkidle' })
      const settings = await apiGet(slug, '/settings', token)
      const data = settings.json?.data || settings.json?.Data || {}
      const companyName = data.COMPANY_NAME_EN || data.companyNameEn || data.companyName
      expect(companyName, 'company name from settings').toBeTruthy()
      await expect.poll(() => page.title()).toBe(companyName)
      const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tenant-brand').trim())
      expect(brand).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      // No other tenant's slug appears anywhere on the page.
      const text = await page.locator('body').innerText()
      for (const other of TENANTS.filter((t) => t !== slug)) {
        expect(text.toLowerCase()).not.toContain(other)
      }
    })
  }

  test('a token from one tenant is refused on another tenant host', async () => {
    test.skip(TENANTS.length < 2, 'needs two tenants')
    const [a, b] = TENANTS
    const { token } = await apiLogin(a)
    const own = await apiGet(a, '/customers?page=1&pageSize=1', token)
    expect(own.status).toBe(200)
    const cross = await apiGet(b, '/customers?page=1&pageSize=1', token)
    expect([401, 403]).toContain(cross.status)
  })
})
