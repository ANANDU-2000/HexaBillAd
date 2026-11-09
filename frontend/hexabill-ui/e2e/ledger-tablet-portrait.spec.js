// Customer Ledger on a portrait tablet (752x1254): icons-only rail, one back arrow, Pending as a dense table,
// Bills without sideways scroll. Own data only (fresh owing customer). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
import { createOwingCustomer } from './fixtures.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test.use({ viewport: { width: 752, height: 1254 }, hasTouch: true })

async function openLedger (page) {
  const name = `QA tablet ledger ${`${Date.now()}`.slice(-9)}`
  await createOwingCustomer(SLUG, name)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customer' }).fill(name)
  await page.locator('main button').filter({ hasText: name }).first().click()
  await page.waitForLoadState('networkidle')
}

test('sidebar is an icons-only rail on a portrait tablet', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: 'Main' })
  const box = await nav.boundingBox()
  expect(box.width).toBeLessThan(80)
  await expect(nav.getByRole('link', { name: 'Products' })).toBeVisible()
})

test('pending tab is a table with a one-tap Pay and a single back arrow', async ({ page }) => {
  await openLedger(page)
  await expect(page.getByRole('tab', { name: /Pending/ })).toBeVisible()
  const table = page.locator('main table').first()
  await expect(table).toBeVisible()
  const pay = table.getByRole('button', { name: 'Pay', exact: true }).first()
  await expect(pay).toBeVisible()
  expect((await pay.boundingBox()).height).toBeGreaterThanOrEqual(43.5)
  const row = table.locator('tbody tr').first()
  expect((await row.boundingBox()).height).toBeLessThan(90)
  // Only one visible back control (page arrow); the shell Back is hidden on /ledger.
  await expect(page.locator('[data-testid=shell-back]:visible')).toHaveCount(0)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('bills tab has no sideways scroll on a tablet', async ({ page }) => {
  await openLedger(page)
  await page.getByRole('tab', { name: /Bills/ }).click()
  const table = page.locator('main table').first()
  await expect(table).toBeVisible()
  const scrolls = await table.evaluate((el) => {
    let n = el.parentElement
    while (n && n !== document.body) {
      if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible') return true
      n = n.parentElement
    }
    return false
  })
  expect(scrolls).toBe(false)
})
