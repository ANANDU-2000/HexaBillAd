// Functional checks for the redesigned Customers and Payments screens, with realistic volume
// (221 customers, 250 current + 60 historical payments for gulfharvest-test; frozenhub1-test has no history).
// Read-only: nothing is created, edited, voided or paid. Runs per Playwright project (viewport).
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const OTHER_SLUG = process.env.HEXABILL_E2E_OTHER_SLUG || 'frozenhub1-test'

const isPhone = (page) => page.viewportSize().width < 768
const rowsOf = (page) => (isPhone(page) ? page.locator('ul.md\\:hidden > li') : page.locator('tbody tr'))
const footer = (page) => page.locator('nav[aria-label="Pagination"]')
const num = (text) => Number(String(text).replace(/[^0-9.]/g, ''))

async function openCustomers (page, path = '/customers') {
  await page.goto(`${feOrigin(SLUG)}${path}`, { waitUntil: 'domcontentloaded' })
  await expect(rowsOf(page).first()).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
}

async function openPayments (page, slug = SLUG) {
  await page.goto(`${feOrigin(slug)}/payments`, { waitUntil: 'domcontentloaded' })
  await expect(rowsOf(page).first()).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
}

test.beforeEach(async ({ page }) => { await signIn(page, SLUG) })

test.describe('Customers', () => {
  test('lists every customer with server-side counts that match the tabs', async ({ page }) => {
    await openCustomers(page)
    await expect(page.getByText('221 customers').first()).toBeVisible()
    await expect(footer(page)).toContainText('of 221')
    const owes = page.getByRole('tab', { name: /^Owes money/ })
    const badge = num(await owes.innerText())
    expect(badge).toBeGreaterThan(100) // more than one page: the old in-browser filter could never see these
    await owes.click()
    await expect(footer(page)).toContainText(`of ${badge}`)
    const overdue = page.getByRole('tab', { name: /^Overdue/ })
    const overdueCount = num(await overdue.innerText())
    await overdue.click()
    await expect(footer(page)).toContainText(`of ${overdueCount}`)
    await expect(rowsOf(page).first()).toContainText('Overdue 30+ days')
  })

  test('names sort naturally (1, 3, 4 ... 10), not alphabetically', async ({ page }) => {
    await openCustomers(page)
    const names = await rowsOf(page).locator(isPhone(page) ? 'button span, button' : 'td:first-child button').allInnerTexts()
    const ajman = names.map((n) => n.trim()).filter((n) => /^Ajman Frozen Goods \d+$/.test(n)).map((n) => Number(n.split(' ').pop()))
    expect(ajman.length).toBeGreaterThan(5)
    expect(ajman).toEqual([...ajman].sort((a, b) => a - b))
    expect(ajman).toContain(10)
    expect(ajman.indexOf(3)).toBeLessThan(ajman.indexOf(10)) // alphabetical order would put 10 before 3
  })

  test('search narrows the list server-side and clearing restores it', async ({ page }) => {
    await openCustomers(page)
    const box = page.getByRole('searchbox', { name: 'Search customers' })
    await box.fill('Al Noor Trading 11')
    await expect(footer(page)).toContainText('of 1', { timeout: 10000 })
    await expect(rowsOf(page)).toHaveCount(1)
    await expect(rowsOf(page).first()).toContainText('Al Noor Trading 11')
    await box.fill('+9715100')
    await expect(rowsOf(page).first()).toBeVisible()
    await box.fill('')
    await expect(footer(page)).toContainText('of 221', { timeout: 10000 })
    await box.fill('zzzz-no-such-customer')
    await expect(page.getByRole('heading', { name: 'No customers match' })).toBeVisible({ timeout: 10000 })
  })

  test('sorting by balance and by recent activity, and paging', async ({ page }) => {
    await openCustomers(page)
    if (isPhone(page)) {
      await page.getByLabel('Sort customers').selectOption('balanceDesc')
    } else {
      await page.getByRole('button', { name: 'Balance due' }).click()
    }
    await expect.poll(async () => {
      // the first money amount in each visible row is the customer's balance
      const texts = await rowsOf(page).allInnerTexts()
      const n = texts.slice(0, 6).map((t) => num((t.match(/(\d[\d,]*\.\d{2}) AED/) || [])[1]))
      return n.length > 1 && n.every((v) => Number.isFinite(v)) && n.every((v, i) => i === 0 || n[i - 1] >= v)
    }, { timeout: 10000 }).toBe(true)
    // page 2 of the sorted list
    await footer(page).getByRole('button', { name: /Next page/ }).click()
    await expect(footer(page)).toContainText('51-100 of 221')
    // rows per page
    await footer(page).getByLabel('Rows per page').selectOption('100')
    await expect(footer(page)).toContainText('1-100 of 221')
  })

  test('Ledger, Collect and the name link navigate to the right places', async ({ page }) => {
    await openCustomers(page)
    const first = rowsOf(page).first()
    await first.getByRole('button', { name: /Open ledger for/ }).click()
    await expect(page).toHaveURL(/\/ledger\?.*customerId=\d+/)
    await page.goBack()
    await expect(rowsOf(page).first()).toBeVisible()
    await rowsOf(page).first().getByRole('button', { name: /Collect payment from/ }).click()
    await expect(page).toHaveURL(/\/ledger\?.*customerId=\d+.*(openPayment=1|recordPayment)|\/ledger\?.*tab=payments/)
    await page.goBack()
    await rowsOf(page).first().getByRole('button').filter({ hasText: /Ajman|Al |Gulf|Union|Falcon|Pearl|Majestic|Marina|Red Sea|Royal|Sharjah|Skyline|Blue|Bin|Crescent|Desert|Dubai|Emirates|Oasis/ }).first().click()
    await expect(page).toHaveURL(/\/customers\/\d+/)
  })

  test('More menu opens fully inside the screen, even on the last visible row', async ({ page }) => {
    await openCustomers(page)
    const rows = rowsOf(page)
    const n = await rows.count()
    const target = rows.nth(Math.min(n - 1, isPhone(page) ? 2 : 7))
    await target.scrollIntoViewIfNeeded()
    await target.getByRole('button', { name: /More actions for/ }).click()
    const menu = page.getByRole('menu').last()
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    const vp = page.viewportSize()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1)
    await expect(menu.getByRole('menuitem', { name: 'Edit customer' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('Add customer opens the form without leaving the page', async ({ page }) => {
    await openCustomers(page)
    await page.getByRole('button', { name: 'Add customer' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel(/Customer Name/i)).toBeVisible()
  })
})

test.describe('Payments', () => {
  test('one merged history for a tenant that owns historical payments, with no Starplus label or fixed count', async ({ page }) => {
    await openPayments(page)
    await expect(page.getByText(/Starplus/i)).toHaveCount(0)
    await expect(page.getByText('5,330')).toHaveCount(0)
    const source = page.getByRole('group', { name: 'Payment source' })
    await expect(source).toBeVisible()
    await expect(page.getByText('310 payments').first()).toBeVisible() // 250 recorded here + 60 historical
    await source.getByRole('button', { name: 'Recorded here' }).click()
    await expect(page.getByText('250 payments').first()).toBeVisible()
    await source.getByRole('button', { name: 'Historical' }).click()
    await expect(page.getByText('60 payments').first()).toBeVisible()
    await expect(rowsOf(page).first()).toContainText('Historical')
    await expect(rowsOf(page).first()).toContainText('Read-only')
    await expect(rowsOf(page).first().getByRole('button', { name: /Receipt/ })).toHaveCount(0)
    await expect(rowsOf(page).first().getByRole('checkbox')).toHaveCount(0)
  })

  test('another tenant sees only its own payments and no historical option', async ({ page }) => {
    await signIn(page, OTHER_SLUG)
    await openPayments(page, OTHER_SLUG)
    await expect(page.getByRole('group', { name: 'Payment source' })).toHaveCount(0)
    await expect(page.getByText(/Historical/i)).toHaveCount(0)
    await expect(page.getByText(/Starplus|5,330/)).toHaveCount(0)
    await expect(footer(page)).toBeHidden().catch(() => {})
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/OLD-|STAR-|Old Starplus/)
    expect(text).not.toMatch(/Gulf Fresh|Al Noor|Ajman Frozen/) // gulfharvest-test customers never appear here
  })

  test('search, method and status filters work together and can be cleared', async ({ page }) => {
    await openPayments(page)
    await page.getByRole('group', { name: 'Payment source' }).getByRole('button', { name: 'Recorded here' }).click()
    await expect(page.getByText('250 payments').first()).toBeVisible()
    const box = page.getByRole('searchbox', { name: 'Search payments' })
    await box.fill('REF-114060')
    await expect(page.getByText('1 matching payment').first()).toBeVisible({ timeout: 10000 })
    await expect(rowsOf(page).first()).toContainText('Al Wahda Grocery')
    await box.fill('')
    await page.getByLabel('Payment method').selectOption('Cheque')
    await expect.poll(async () => (await page.locator('main').innerText()).match(/(\d[\d,]*) matching payments/)?.[1], { timeout: 10000 }).toBeTruthy()
    const cheques = isPhone(page) ? null : await rowsOf(page).locator('td:nth-child(4)').allInnerTexts()
    if (cheques) cheques.forEach((c) => expect(c).toContain('Cheque'))
    await page.getByLabel('Payment status').selectOption('pending')
    await expect(rowsOf(page).first()).toContainText('Pending')
    await page.getByRole('button', { name: 'Clear payment filters' }).click()
    await expect(page.getByText('250 payments').first()).toBeVisible({ timeout: 10000 })
  })

  test('pagination and rows per page', async ({ page }) => {
    await openPayments(page)
    await expect(footer(page)).toContainText('1-50 of 310')
    await footer(page).getByRole('button', { name: /Next page/ }).click()
    await expect(footer(page)).toContainText('51-100 of 310')
    await footer(page).getByLabel('Rows per page').selectOption('25')
    await expect(footer(page)).toContainText('1-25 of 310')
    await footer(page).getByRole('button', { name: /Next page/ }).click()
    await expect(footer(page)).toContainText('26-50 of 310')
    await expect(page).toHaveURL(/page=2/)
  })

  test('actions: Receipt opens a receipt preview, More offers edit/void, a pending cheque offers Mark cleared', async ({ page }) => {
    await openPayments(page)
    await page.getByRole('group', { name: 'Payment source' }).getByRole('button', { name: 'Recorded here' }).click()
    await expect(page.getByText('250 payments').first()).toBeVisible()
    // a pending cheque (seeded) can be marked cleared; we only check the control exists, we do not click it
    await page.getByLabel('Payment status').selectOption('pending')
    await expect(rowsOf(page).first().getByRole('button', { name: /Mark cleared/ })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Clear payment filters' }).click()
    await expect(page.getByText('250 payments').first()).toBeVisible({ timeout: 10000 })
    // receipt preview from a cleared cash payment
    await page.getByLabel('Payment method').selectOption('Cash')
    await page.getByLabel('Payment status').selectOption('completed')
    await expect(rowsOf(page).first()).toBeVisible()
    await rowsOf(page).first().getByRole('button', { name: /Print receipt for payment/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')
  })

  test('More menu stays inside the screen and lists void/edit; Add Payment and Bulk Payment open their forms', async ({ page }) => {
    await openPayments(page)
    const rows = rowsOf(page)
    const target = rows.nth(Math.min((await rows.count()) - 1, isPhone(page) ? 1 : 6))
    await target.scrollIntoViewIfNeeded()
    await target.getByRole('button', { name: /More actions for payment/ }).click()
    const menu = page.getByRole('menu').last()
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    const vp = page.viewportSize()
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)
    await expect(menu.getByRole('menuitem', { name: 'Void payment' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Edit payment' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add Payment' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('button', { name: 'Bulk Payment' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('no network chatter: searching does not reload the whole customer list', async ({ page }) => {
    const customerCalls = []
    page.on('request', (r) => { if (/\/api\/customers(\?|$)/.test(r.url())) customerCalls.push(r.url()) })
    await openPayments(page)
    const afterLoad = customerCalls.length
    const box = page.getByRole('searchbox', { name: 'Search payments' })
    await box.fill('Gulf')
    await page.waitForTimeout(900)
    await box.fill('Al')
    await page.waitForTimeout(900)
    expect(customerCalls.length).toBe(afterLoad) // the customer list loads once per session, not per search
  })
})
