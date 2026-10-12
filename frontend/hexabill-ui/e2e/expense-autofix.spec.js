import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function apiExpenses () {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}/api/expenses?page=1&pageSize=200`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  const j = await r.json()
  return (j.data ?? j).items || []
}

async function ensureCategory () {
  const s = await apiLogin(SLUG)
  const headers = { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json' }
  const list = await (await fetch(`${API}/api/expenses/categories`, { headers })).json()
  if ((list.data ?? list).length) return
  const res = await fetch(`${API}/api/expenses/categories`, { method: 'POST', headers, body: JSON.stringify({ name: 'QA Fuel', colorCode: '#2563eb', isActive: true }) })
  expect(res.status).toBeLessThan(300)
}

async function openForm (page) {
  await ensureCategory()
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/expenses`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Add expense$/ }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  return dialog
}

test('an amount with extra decimals is rounded and saved without a browser bubble', async ({ page }) => {
  const note = `QA expense ${Date.now()}`
  const dialog = await openForm(page)
  await dialog.locator('select[name="category"]').selectOption({ index: 1 })
  await dialog.locator('input[name="amount"]').fill('45.678')
  await dialog.locator('[name="note"]').fill(`  ${note}  `)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await apiExpenses()).filter(e => e.note === note).length).toBe(1)
})

test('a missing amount explains what to type', async ({ page }) => {
  const dialog = await openForm(page)
  await dialog.locator('select[name="category"]').selectOption({ index: 1 })
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog.getByText('Type the amount, for example 45.50')).toBeVisible()
  await expect(dialog).toBeVisible()
})

test('a lost server answer after an expense was saved is not shown as a failure', async ({ page }) => {
  const note = `QA lost expense ${Date.now()}`
  const dialog = await openForm(page)
  let posts = 0
  await page.route(/\/api\/expenses$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    await route.fetch({
      url: `${API}/api/expenses`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await dialog.locator('select[name="category"]').selectOption({ index: 1 })
  await dialog.locator('input[name="amount"]').fill('12.50')
  await dialog.locator('[name="note"]').fill(note)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Expense added successfully!').first()).toBeVisible()
  expect(posts).toBe(1)
  expect((await apiExpenses()).filter(e => e.note === note)).toHaveLength(1)
})
