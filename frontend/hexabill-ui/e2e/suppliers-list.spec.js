// Suppliers list: full-width search, card actions in one menu, and add -> persisted -> deactivate.
// Synthetic local tenant only. Run: npx playwright test e2e/suppliers-list.spec.js
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const SEEDED = 'UX Audit Supplier Gulf Produce LLC'

async function api (path) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

// Mobile cards and the desktop row share the label (the row and its eye button); take the first visible one.
const card = (page, name) => page.getByLabel(`Open ${name}`).filter({ visible: true }).first()

async function openSuppliers (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers`, { waitUntil: 'networkidle' })
}

test('search uses the full width and each card has one actions menu', async ({ page }, info) => {
  await openSuppliers(page)
  const search = page.getByLabel('Search suppliers')
  await expect(search).toBeVisible()
  const box = await search.boundingBox()
  // At 360px the search was about 210px and clipped its placeholder. It is now the full content width.
  expect(box.width).toBeGreaterThan(info.project.use.viewport.width < 768 ? 280 : 300)

  // Phones: one menu per card. Desktop uses the same menu (owners see it at every width).
  const menu = page.getByRole('button', { name: `More actions for ${SEEDED}` })
  await expect(menu).toBeVisible()
  await menu.click()
  await expect(page.getByRole('menuitem', { name: 'Edit supplier' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Deactivate supplier' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'Edit supplier' })).toHaveCount(0)
})

test('add supplier -> persisted -> deactivate -> hidden by default', async ({ page }) => {
  const name = `UX Supplier ${Date.now()}`
  await openSuppliers(page)

  await page.getByRole('button', { name: 'Add Supplier' }).click()
  await page.locator('#create-name').fill(name)
  await page.locator('#create-phone').fill('+971500000002')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/suppliers$/.test(r.url()))
  await page.getByRole('button', { name: 'Create Supplier' }).click()
  expect((await created).status()).toBeLessThan(300)
  await expect.poll(async () => (await api(`/api/suppliers/by-name/${encodeURIComponent(name)}`)).status).toBe(200)

  await page.reload({ waitUntil: 'networkidle' })
  await expect(card(page, name)).toBeVisible()

  await page.getByRole('button', { name: `More actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: 'Deactivate supplier' }).click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  const deactivated = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/suppliers\//.test(r.url()))
  await dialog.getByRole('button', { name: /deactivate|confirm/i }).last().click()
  expect((await deactivated).status()).toBeLessThan(300)

  // Deactivated suppliers are hidden until "Include deactivated" is on.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(card(page, name)).toHaveCount(0)
  await page.getByLabel('Include deactivated').check()
  await expect(card(page, name)).toBeVisible()
  await expect(card(page, name)).toContainText('Deactivated')
})
