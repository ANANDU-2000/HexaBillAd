// UX-03: touch tablets keep 44px controls and a 16px root at 820/1024/1180, with no horizontal page overflow
// on the main pages; mouse desktops keep the compact 14px root. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const TABLETS = [[820, 1180], [1024, 768], [1180, 820]]
const PAGES = ['/dashboard', '/purchases', '/products', '/customers']
// Wider sweep for the UX-03 shell check: every main business route, in both orientations.
const SWEEP = ['/pos', '/payments', '/expenses', '/ledger', '/reports', '/vat-return', '/daily-close', '/suppliers', '/quotations',
  '/delivery-notes', '/salary-certificates', '/pricelist', '/users', '/settings', '/branches', '/routes', '/sales-ledger', '/billing-history']

for (const [w, h] of TABLETS) {
  test.describe(`touch tablet ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })

    test('16px root, 44px dashboard action, no page overflow', async ({ page }) => {
      await signIn(page, SLUG)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'emulated touch pointer').toBe(true)
      for (const path of PAGES) {
        await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'networkidle' })
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), `${path} root font size`).toBe('16px')
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} horizontal overflow`).toBeLessThanOrEqual(1)
      }
      await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
      const newInvoice = page.getByRole('button', { name: /New invoice/ }).first()
      if (await newInvoice.count()) {
        const box = await newInvoice.boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(43.5)
      }
    })
  })
}

for (const [w, h] of TABLETS) {
  test.describe(`touch tablet sweep ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })

    test('no horizontal page overflow and a 16px root on every main route', async ({ page }) => {
      await signIn(page, SLUG)
      const problems = []
      for (const path of SWEEP) {
        await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'networkidle' })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        const root = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
        if (overflow > 1) problems.push(`${path}: overflows by ${overflow}px`)
        if (root !== '16px') problems.push(`${path}: root ${root}`)
      }
      expect(problems, problems.join('; ')).toEqual([])
    })
  })
}

test.describe('mouse desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false })
  test('keeps the compact 14px root', async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('14px')
  })
})
