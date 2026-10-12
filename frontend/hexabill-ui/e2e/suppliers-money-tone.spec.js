import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

test('suppliers page renders and zero balances use the quiet neutral colour', async ({ page }, info) => {
  const session = await apiLogin(SLUG)
  const name = `QA supplier ${Date.now()}`
  const res = await fetch(`${API}/api/suppliers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone: `055${String(Date.now()).slice(-7)}` }),
  })
  expect(res.status).toBeLessThan(300)
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers?search=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible()
  const zero = page.locator('td.tabular-nums:visible', { hasText: '0.00' }).first()
  if (await zero.count()) {
    const color = await zero.evaluate(el => getComputedStyle(el).color)
    expect(color).not.toBe('rgb(185, 28, 28)')
  }
  await page.screenshot({ path: info.outputPath('suppliers-tone.png') })
})
