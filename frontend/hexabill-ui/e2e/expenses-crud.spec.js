// M4 Expenses: real create / edit / delete through the UI, each confirmed against the API
// (persistence, not a toast). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const NOTE = `UX CRUD ${Date.now()}`

async function apiExpenses (page) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}/api/expenses?page=1&pageSize=200`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  const j = await r.json()
  const d = j.data ?? j
  return d.items || d.Items || d
}

test('expense create -> persisted -> edit -> persisted -> delete -> gone', async ({ page }, info) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })

  // CREATE
  await page.getByRole('button', { name: /^Add expense$/ }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  if (info.project.use.viewport.width < 768) {
    // Save must be reachable without scrolling the page away (UX-E04).
    await expect(dialog.getByRole('button', { name: 'Save expense' })).toBeInViewport()
  }
  await dialog.locator('select[name="category"]').selectOption({ index: 1 })
  await dialog.locator('input[name="amount"]').fill('125.50')
  await dialog.locator('[name="note"]').fill(NOTE)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toBeHidden()

  // Persisted in the database (read back through the API), not just shown.
  await expect.poll(async () => (await apiExpenses(page)).some((e) => e.note === NOTE)).toBe(true)
  const created = (await apiExpenses(page)).find((e) => e.note === NOTE)
  // The form defaults to "Amount (incl. VAT)": 125.50 gross is stored as 119.52 net + 5% VAT.
  expect(Number(created.totalAmount ?? created.amount * 1.05)).toBeCloseTo(125.5, 2)

  // Refresh: the row is still there with the saved amount.
  await page.reload({ waitUntil: 'networkidle' })
  const row = page.locator(info.project.use.viewport.width < 768 ? 'main li' : 'main tbody tr').filter({ hasText: NOTE }).first()
  await expect(row).toBeVisible()

  // EDIT
  await row.getByRole('button', { name: /^Edit / }).click()
  const edit = page.getByRole('dialog').first()
  await expect(edit).toBeVisible()
  await edit.locator('input[name="amount"]').fill('200')
  const put = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/expenses\//.test(r.url()))
  await edit.getByRole('button', { name: 'Update expense', exact: false }).click()
  expect((await put).status()).toBe(200)
  await expect(edit).toBeHidden()
  await expect.poll(async () => Number((await apiExpenses(page)).find((e) => e.note === NOTE)?.totalAmount)).toBeCloseTo(200, 2)

  // DELETE (confirmation required)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator(info.project.use.viewport.width < 768 ? 'main li' : 'main tbody tr').filter({ hasText: NOTE }).first()
    .getByRole('button', { name: /^Delete / }).click()
  await page.getByRole('dialog').first().getByRole('button', { name: /delete|confirm/i }).last().click()
  await expect.poll(async () => (await apiExpenses(page)).some((e) => e.note === NOTE)).toBe(false)
})
