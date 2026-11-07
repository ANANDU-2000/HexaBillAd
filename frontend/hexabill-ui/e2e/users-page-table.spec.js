// UX-A01: Users page table header must be readable and the email must stay on one line.
// Local/dev only. Run through the QA runner (scripts/run-customer-save-qa.ps1) or with API + Vite up:
//   npx playwright test e2e/users-page-table.spec.js --project=d1440
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const OWNER_EMAIL = process.env[`HEXABILL_E2E_EMAIL_${SLUG.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`] || `${SLUG}@hexabill.company`

// WCAG contrast of the header text colour against the first opaque background above it.
async function headerContrast (page) {
  return page.evaluate(() => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] } }
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.9) return c } return { r: 255, g: 255, b: 255, a: 1 } }
    const ths = [...document.querySelectorAll('table thead th')].filter((t) => t.offsetParent !== null && /name/i.test(t.textContent) || false)
    const th = ths[0]
    if (!th) return null
    const fg = parse(getComputedStyle(th).color)
    const bg = bgOf(th)
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    return { ratio: (hi + 0.05) / (lo + 0.05), fg: getComputedStyle(th).color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})` }
  })
}

test.describe('Users page (UX-A01)', () => {
  test.describe('desktop table 1440', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('headers are readable and rows are compact with the email on one line', async ({ page }, info) => {
      await signIn(page, SLUG)
      await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })
      await expect(page.locator('table thead th').first()).toBeVisible()

      const c = await headerContrast(page)
      expect(c, 'header cell "Name" must exist').not.toBeNull()
      expect(c.ratio, `header text ${c.fg} on ${c.bg}`).toBeGreaterThanOrEqual(4.5)

      // Headers must label their columns: Status holds Online/Offline, Role holds the role pill.
      const heads = (await page.locator('table thead th').allInnerTexts()).map((t) => t.trim())
      const cells = (await page.locator('table tbody tr').first().locator('td').allInnerTexts()).map((t) => t.trim())
      expect(cells[heads.indexOf('Status')], 'Status column shows presence').toMatch(/^(Online|Offline)$/)
      expect(cells[heads.indexOf('Role')], 'Role column shows the role').toMatch(/owner|admin|staff/i)

      const email = page.locator('table tbody').getByText(OWNER_EMAIL, { exact: true }).first()
      await expect(email).toBeVisible()
      await expect(email, 'full email stays reachable when truncated').toHaveAttribute('title', OWNER_EMAIL)
      const box = await email.boundingBox()
      expect(box.height, 'email text must be one line').toBeLessThanOrEqual(24)
      const rowH = await email.evaluate((el) => el.closest('tr').getBoundingClientRect().height)
      expect(rowH, 'every row <= 48px').toBeLessThanOrEqual(48)

      await page.screenshot({ path: info.outputPath('users-1440.png'), fullPage: false })
    })
  })

  test.describe('tablet landscape 1254', () => {
    test.use({ viewport: { width: 1254, height: 752 } })

    test('email stays on one line in the list', async ({ page }, info) => {
      await signIn(page, SLUG)
      await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })
      const email = page.getByText(OWNER_EMAIL, { exact: true }).filter({ visible: true }).first()
      await expect(email).toBeVisible()
      const box = await email.boundingBox()
      expect(box.height, 'email text must be one line').toBeLessThanOrEqual(24)
      await page.screenshot({ path: info.outputPath('users-1254.png'), fullPage: false })
    })
  })
})
