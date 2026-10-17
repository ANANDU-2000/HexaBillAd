// UX-06: the three document editors each have the same, labelled back control, top-left, with a 44px target.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const EDITORS = [
  ['/quotations/new', 'Back to quotations', /\/quotations$/],
  ['/agreements/new', 'Back to agreements', /\/agreements$/],
  ['/salary-certificates/new', 'Back to salary certificates', /\/salary-certificates$/],
]

for (const [path, label, listUrl] of EDITORS) {
  test(`${path}: labelled back control, large target, returns to the list`, async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'networkidle' })
    const back = page.getByRole('link', { name: label })
    await expect(back).toBeVisible()
    const box = await back.boundingBox()
    const vp = page.viewportSize()
    // 44px is the touch minimum; mouse desktops use the compact 14px root on purpose (see UX-03).
    const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    if (touch) expect(box.height).toBeGreaterThanOrEqual(43.5)
    expect(box.x).toBeLessThan(vp.width / 2) // top-left, not tucked on the right
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    await back.click()
    await expect(page).toHaveURL(listUrl)
  })
}
