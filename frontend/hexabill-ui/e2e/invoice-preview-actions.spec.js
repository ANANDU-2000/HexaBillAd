// MOB-P1-3: the invoice preview has one primary action (Share), one secondary (New sale) and a "…" menu,
// instead of six equal coloured buttons. Read-only except the PDF download. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const preview = (page) => page.getByRole('dialog', { name: 'Invoice preview' })

async function openFirstInvoice (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/billing-history`, { waitUntil: 'networkidle' })
  const rows = page.locator('main ul.md\\:hidden > li')
  await expect(rows.first()).toBeVisible()
  await rows.first().getByRole('button', { name: /^Open invoice/ }).click()
  await expect(page.getByRole('dialog', { name: 'Invoice preview' }).getByRole('heading', { name: /^Invoice Preview/ })).toBeVisible()
  await expect(page.getByText('Grand Total:')).toBeVisible()
}

test.describe('phone invoice preview actions', () => {
  test.beforeEach(({ page }) => {
    test.skip(page.viewportSize().width >= 768, 'phone list layout')
  })

  test('Share, New sale and the more menu replace the six-button row', async ({ page }) => {
    const vp = page.viewportSize()
    await openFirstInvoice(page)

    const share = preview(page).getByRole('button', { name: 'Share', exact: true })
    const newSale = preview(page).getByRole('button', { name: 'New sale', exact: true })
    const more = preview(page).getByRole('button', { name: 'More actions' })
    for (const button of [share, newSale, more]) {
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
    }
    // The old row of coloured buttons is gone.
    for (const name of ['Return Items', 'Print', 'PDF', 'WhatsApp', 'Email', 'New Invoice']) {
      await expect(preview(page).getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

    await share.click()
    const sheet = page.getByRole('dialog', { name: 'Share invoice' })
    await expect(sheet).toBeVisible()
    for (const name of [/^WhatsApp/, /^Email/, /^Download PDF/, /^Print/]) {
      const option = sheet.getByRole('button', { name })
      await expect(option).toBeVisible()
      expect((await option.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
  })

  test('Download PDF from the share sheet produces a file', async ({ page }) => {
    await openFirstInvoice(page)
    await preview(page).getByRole('button', { name: 'Share', exact: true }).click()
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('dialog', { name: 'Share invoice' }).getByRole('button', { name: /^Download PDF/ }).click()
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/i)
  })

  test('Return items lives in the more menu and New sale opens the bill screen', async ({ page }) => {
    await openFirstInvoice(page)
    await preview(page).getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('dialog', { name: 'More actions' }).getByRole('button', { name: /^Return items/ }).click()
    await expect(page).toHaveURL(/\/returns\/create\?saleId=\d+/)

    await openFirstInvoice(page)
    await preview(page).getByRole('button', { name: 'New sale', exact: true }).click()
    await expect(page).toHaveURL(/\/pos/)
  })
})
