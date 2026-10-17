// AI-01/AI-02 front end (no model): the assistant panel is off by default, opens as a right panel (full-screen on phones),
// looks things up read-only, and creates a customer only through review and confirm. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function customersNamed (name) {
  const r = await api(`/api/customers?search=${encodeURIComponent(name)}&pageSize=50`)
  const items = r.json.data?.items ?? []
  return items.filter((c) => c.name === name)
}


async function ensureExpenseCategory () {
  const list = await api('/api/expenses/categories')
  const first = (list.json.data ?? [])[0]
  if (first) return first
  const made = await api('/api/expenses/categories', { method: 'POST', body: JSON.stringify({ name: `Panel Test Category ${Date.now()}` }) })
  expect(made.status, JSON.stringify(made.json)).toBeLessThan(300)
  return made.json.data
}

async function expensesWithNote (note) {
  const r = await api('/api/expenses?page=1&pageSize=100')
  const items = r.json.data?.items ?? []
  return items.filter((e) => e.note === note)
}

const openPanel = async (page) => {
  await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Assistant' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('flag off (default)', () => {
  test('no assistant entry point exists', async ({ page }) => {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Open assistant' })).toHaveCount(0)
  })
})

test.describe('flag on', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('hexabill.assistant', '1') } catch { /* storage blocked */ } })
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  })

  test('side panel on larger screens, full-screen on phones; full-screen toggle; Escape closes', async ({ page }) => {
    const dialog = await openPanel(page)
    const vp = page.viewportSize()
    const box = await dialog.boundingBox()
    if (vp.width < 768) {
      expect(Math.round(box.width)).toBe(vp.width)
      expect(Math.round(box.height)).toBe(vp.height)
      await expect(page.getByRole('button', { name: 'Full screen' })).toBeHidden()
    } else {
      expect(box.width).toBeLessThan(vp.width * 0.6)
      expect(Math.round(box.x + box.width)).toBe(vp.width) // docked to the right edge
      await page.getByRole('button', { name: 'Full screen' }).click()
      expect(Math.round((await dialog.boundingBox()).width)).toBe(vp.width)
      await page.getByRole('button', { name: 'Use side panel' }).click()
      expect((await dialog.boundingBox()).width).toBeLessThan(vp.width * 0.6)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  test('look up finds this company\'s customer, read-only', async ({ page }) => {
    const name = `Panel Lookup Buyer ${Date.now()}`
    const made = await api('/api/customers', { method: 'POST', body: JSON.stringify({ name, phone: '05' + String(Date.now()).slice(-8) }) })
    expect(made.status, JSON.stringify(made.json)).toBeLessThan(300)
    const dialog = await openPanel(page)
    await dialog.getByLabel('Name, phone or SKU').fill(name)
    await dialog.getByRole('button', { name: 'Search' }).click()
    await expect(dialog.getByRole('list', { name: 'Results' }).getByText(name)).toBeVisible()
    await expect(dialog.getByText('Nothing was changed.')).toBeVisible()
  })

  test('new customer: field errors block confirm; editing clears the review; confirm creates exactly one', async ({ page }) => {
    const name = `Panel Draft Buyer ${Date.now()}`
    const dialog = await openPanel(page)
    await dialog.getByRole('tab', { name: 'New customer' }).click()

    // Invalid email is shown on its own field and Confirm is disabled.
    await dialog.getByLabel('Customer name *').fill(name)
    await dialog.getByLabel('Email').fill('not-an-email')
    await dialog.getByRole('button', { name: 'Review' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'valid email' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirm and create' })).toBeDisabled()
    expect(await customersNamed(name)).toHaveLength(0)

    // Editing after a review removes the review, so what is confirmed is always what was shown.
    await dialog.getByLabel('Email').fill('buyer@example.test')
    await expect(dialog.getByRole('region', { name: 'Review before creating' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Review' }).click()
    const review = dialog.getByRole('region', { name: 'Review before creating' })
    await expect(review).toContainText(name)
    await expect(review).toContainText('buyer@example.test')
    await expect(dialog.getByRole('button', { name: 'Confirm and create' })).toBeEnabled()
    expect(await customersNamed(name)).toHaveLength(0) // review alone saves nothing

    // Two fast taps still create one customer.
    const confirm = dialog.getByRole('button', { name: 'Confirm and create' })
    await confirm.dblclick()
    await expect(dialog.getByRole('status').filter({ hasText: 'Customer created' })).toBeVisible()
    expect(await customersNamed(name)).toHaveLength(1)
  })

  test('an uncertain confirm failure is not offered as a retry and says to check the list', async ({ page }) => {
    const name = `Panel Uncertain Buyer ${Date.now()}`
    await page.route(/\/api\/assistant\/drafts\/[0-9a-f-]+\/confirm/, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }))
    const dialog = await openPanel(page)
    await dialog.getByRole('tab', { name: 'New customer' }).click()
    await dialog.getByLabel('Customer name *').fill(name)
    await dialog.getByRole('button', { name: 'Review' }).click()
    await dialog.getByRole('button', { name: 'Confirm and create' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'not certain' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Open Customers' })).toBeVisible()
    expect(await customersNamed(name)).toHaveLength(0) // the request was intercepted, so nothing was created

    // Closing the panel cancels the reviewed draft, so it does not sit against the open-draft limit.
    const cancelled = page.waitForResponse((r) => /\/api\/assistant\/drafts\/[0-9a-f-]+\/cancel/.test(r.url()) && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'Close assistant' }).click()
    expect((await cancelled).status()).toBe(200)
  })

  test('new expense: field errors block confirm, review shows the rounded amount, confirm records exactly one', async ({ page }) => {
    const category = await ensureExpenseCategory()
    const note = `panel-expense-${Date.now()}`
    const dialog = await openPanel(page)
    await dialog.getByRole('tab', { name: 'New expense' }).click()
    await dialog.getByLabel('Category *').selectOption(String(category.id))

    // No amount: the problem is shown on the amount field and nothing can be confirmed.
    await dialog.getByLabel('Note').fill(note)
    await dialog.getByRole('button', { name: 'Review' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'greater than 0' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirm and record' })).toBeDisabled()

    // 12.345 rounds half up to 12.35 on the review, and review alone saves nothing.
    await dialog.getByLabel('Amount *').fill('12.345')
    await dialog.getByRole('button', { name: 'Review' }).click()
    const review = dialog.getByRole('region', { name: 'Review before recording' })
    await expect(review).toContainText('12.35')
    await expect(review).toContainText(note)
    expect(await expensesWithNote(note)).toHaveLength(0)

    // Two fast taps still record one expense, with the reviewed amount.
    await dialog.getByRole('button', { name: 'Confirm and record' }).dblclick()
    await expect(dialog.getByRole('status').filter({ hasText: 'Expense recorded' })).toBeVisible()
    const saved = await expensesWithNote(note)
    expect(saved).toHaveLength(1)
    expect(Number(saved[0].amount)).toBeCloseTo(12.35, 2)
  })

  test('an uncertain expense confirm failure names Expenses and offers no retry', async ({ page }) => {
    const category = await ensureExpenseCategory()
    const note = `panel-expense-uncertain-${Date.now()}`
    await page.route(/\/api\/assistant\/drafts\/[0-9a-f-]+\/confirm/, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) }))
    const dialog = await openPanel(page)
    await dialog.getByRole('tab', { name: 'New expense' }).click()
    await dialog.getByLabel('Category *').selectOption(String(category.id))
    await dialog.getByLabel('Amount *').fill('5')
    await dialog.getByLabel('Note').fill(note)
    await dialog.getByRole('button', { name: 'Review' }).click()
    await dialog.getByRole('button', { name: 'Confirm and record' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'Check the Expenses list' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Open Expenses' }).last()).toBeVisible()
    expect(await expensesWithNote(note)).toHaveLength(0)
    const cancelled = page.waitForResponse((r) => /\/api\/assistant\/drafts\/[0-9a-f-]+\/cancel/.test(r.url()) && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'Close assistant' }).click()
    expect((await cancelled).status()).toBe(200)
  })
})
