// MOB-P1-1: on a phone the owner Home shows sales, collections, what is owed and the two main actions
// (New sale, Receive payment) in the first screen, with no horizontal page scroll. Read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

test('phone Home: KPIs and the two main actions are visible without scrolling', async ({ page }) => {
  const vp = page.viewportSize()
  test.skip(vp.width >= 768, 'phone layout only')

  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })

  const summary = page.getByRole('region', { name: 'Period summary' })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Net sales')
  await expect(summary).toContainText('Collections')
  await expect(summary).toContainText('Receivables')

  const newSale = page.getByRole('button', { name: 'New sale' })
  const receive = page.getByRole('button', { name: 'Receive payment' })
  await expect(newSale).toBeVisible()
  await expect(receive).toBeVisible()
  for (const button of [newSale, receive]) {
    const box = await button.boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.height, 'label stays on one line').toBeLessThanOrEqual(56)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(box.y + box.height, 'inside the first screen').toBeLessThanOrEqual(vp.height)
  }

  // The desktop button stack is not duplicated on a phone.
  await expect(page.getByRole('button', { name: /New invoice/ })).toBeHidden()
  await expect(page.getByRole('button', { name: /New purchase/ })).toBeHidden()

  // Metric values must not be clipped by their cards.
  const clipped = await summary.evaluate((el) => [...el.querySelectorAll('p')].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent))
  expect(clipped, `clipped metric text: ${clipped.join(', ')}`).toEqual([])

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)

  await newSale.click()
  await expect(page).toHaveURL(/\/pos/)
})
