/* eslint-env node */
// Shared-component checks on the dev-only /__design page at every viewport project.
// Needs only Vite on :5173 (no API, no login): npm run dev, then
//   npx playwright test e2e/design-system.spec.js
import { test, expect } from '@playwright/test'

const ORIGIN = process.env.HEXABILL_FE_ORIGIN || 'http://localhost:5173'
const PHONE = 768 // below this width the phone layout applies (Tailwind md)

const overflowX = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('design system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ORIGIN}/__design`, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('design-system')).toBeVisible()
  })

  test('layout: no sideways scroll in LTR or RTL, no page errors', async ({ page }, info) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    expect(await overflowX(page), 'LTR horizontal overflow (px)').toBeLessThanOrEqual(0)
    await page.screenshot({ path: `e2e/.shots/design-system-${info.project.name}.png`, fullPage: true })

    await page.evaluate(() => { document.documentElement.dir = 'rtl' })
    await page.waitForTimeout(100)
    expect(await overflowX(page), 'RTL horizontal overflow (px)').toBeLessThanOrEqual(0)
    await page.screenshot({ path: `e2e/.shots/design-system-rtl-${info.project.name}.png`, fullPage: true })
    expect(errors).toEqual([])
  })

  test('touch targets meet the size rules', async ({ page }, info) => {
    const width = page.viewportSize().width
    const small = await page.evaluate((isPhone) => {
      const min = isPhone ? 44 : 32
      const els = document.querySelectorAll(
        '[data-testid="design-system"] :is(button, input:not([type=checkbox]):not([type=radio]), select, textarea, [role=tab])'
      )
      return [...els]
        .filter((el) => el.offsetParent !== null && !el.closest('[data-size="sm"]') && el.dataset.size !== 'sm')
        .map((el) => ({ el: el.outerHTML.slice(0, 80), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((r) => r.h < min)
    }, width < PHONE)
    expect(small, `controls under the minimum height at ${info.project.name}`).toEqual([])
  })

  test('KPI figures are never clipped', async ({ page }) => {
    const clipped = await page.locator('[data-ds-section="kpi"] p').evaluateAll((ps) =>
      ps.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent)
    )
    expect(clipped).toEqual([])
  })

  test('table becomes cards below md; tabs stay on one row', async ({ page }) => {
    const width = page.viewportSize().width
    const section = page.locator('[data-ds-section="table"]')
    const table = section.locator('table').first()
    const cards = section.locator('ul').first()
    if (width < PHONE) {
      await expect(table).toBeHidden()
      await expect(cards).toBeVisible()
      await expect(cards.locator('li').first()).toContainText('INV-2026-01040')
    } else {
      await expect(table).toBeVisible()
      await expect(cards).toBeHidden()
      // Sorting is keyboard reachable and reflected in aria-sort.
      await section.getByRole('button', { name: 'Total' }).click()
      await expect(section.locator('th[aria-sort="ascending"]')).toHaveCount(1)
    }
    const tops = await section.getByRole('tab').evaluateAll((tabs) => [...new Set(tabs.map((t) => t.offsetTop))])
    expect(tops.length, 'tab rows').toBe(1)
    const tablistOverflow = await section.getByRole('tablist').evaluate((el) => el.getBoundingClientRect().right - window.innerWidth)
    expect(tablistOverflow).toBeLessThanOrEqual(0)
  })

  test('dialog: bottom sheet on phones, centred from md; Esc closes and focus returns', async ({ page }) => {
    const width = page.viewportSize().width
    const opener = page.getByTestId('open-modal')
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Record payment' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    const vh = page.viewportSize().height
    if (width < PHONE) {
      expect(Math.round(box.y + box.height), 'sheet anchored to bottom').toBeGreaterThanOrEqual(vh - 1)
      expect(Math.round(box.width)).toBe(width)
    } else {
      expect(box.y).toBeGreaterThan(8)
      expect(vh - (box.y + box.height)).toBeGreaterThan(8)
    }
    await page.waitForTimeout(150) // initial focus lands after 100ms
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('filter sheet: focus moves in, Esc closes, focus returns', async ({ page }) => {
    const opener = page.getByTestId('open-sheet')
    await opener.click()
    const sheet = page.getByRole('dialog', { name: 'Filter invoices' })
    await expect(sheet).toBeVisible()
    await page.waitForTimeout(50)
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    // Typing in a field must not be interrupted by re-renders stealing focus.
    const field = sheet.getByLabel('From date')
    await field.focus()
    await page.waitForTimeout(100)
    await expect(field).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('overflow menu: keyboard navigation, Esc returns focus', async ({ page }) => {
    const trigger = page.locator('[data-ds-section="buttons"]').getByRole('button', { name: 'More actions' })
    await trigger.click()
    const menu = page.getByRole('menu', { name: 'More actions' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Print' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
    const box = await menu.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('keyboard focus is visible', async ({ page }) => {
    await page.locator('[data-ds-section="buttons"] button').first().focus()
    await page.keyboard.press('Tab')
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement)
      return { shadow: s.boxShadow, outline: s.outlineStyle }
    })
    expect(ring.shadow !== 'none' || ring.outline !== 'none', JSON.stringify(ring)).toBe(true)
  })
})
