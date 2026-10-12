import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

function countByName (tenantId, name) {
  if (!Number.isInteger(Number(tenantId)) || !/^QA ledger [a-z]+ \d+$/.test(name)) throw new Error('Unexpected synthetic SQL lookup values.')
  const sql = `SELECT count(*) FROM "Customers" WHERE "TenantId" = ${Number(tenantId)} AND "Name" = '${name}';`
  return Number(execFileSync(process.env.HEXABILL_QA_PSQL, ['-X', '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim())
}

async function openForm (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/ledger`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add customer', exact: true }).filter({ visible: true }).click()
  return page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
}

async function fill (form, name, phone, stamp) {
  await form.locator('input[name="name"]').fill(name)
  await form.locator('input[name="phone"]').fill(phone)
  await form.locator('input[name="email"]').fill(`qa-ledger-${stamp}@example.test`)
  await form.locator('input[name="trn"]').fill('123456789012345')
  await form.locator('input[name="address"]').fill('Vadanappally')
  await form.locator('select[name="paymentTerms"]').selectOption('Custom')
}

test('ledger Add customer saves the screenshot values', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-7)
  const name = `QA ledger plain ${stamp}`
  const form = await openForm(page)
  await fill(form, name, `+971 55${stamp}`, stamp)
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/customers$/.test(r.url()))
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  expect((await saved).status()).toBe(201)
  expect(countByName((await apiLogin(SLUG)).user.tenantId, name)).toBe(1)
})

test('a lost server answer after a successful save is reconciled, not shown as a failure', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-7)
  const name = `QA ledger lost ${stamp}`
  const form = await openForm(page)
  let posts = 0
  await page.route(/\/api\/customers$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    // The server really saves it; only the answer is lost.
    await route.fetch({
      url: `${API}/api/customers`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await fill(form, name, `+971 56${stamp}`, stamp)
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  await expect(page.getByText('Customer added successfully!').first()).toBeVisible()
  await expect(form).toBeHidden()
  await expect(page.getByText('Failed to create customer')).toHaveCount(0)
  expect(countByName((await apiLogin(SLUG)).user.tenantId, name)).toBe(1)
  expect(posts).toBe(1)
})

test('duplicate phone is blocked on the ledger page with the real reason', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-7)
  const phone = `+971 57${stamp}`
  const first = await openForm(page)
  await fill(first, `QA ledger first ${stamp}`, phone, stamp)
  await first.getByRole('button', { name: 'Add Customer', exact: true }).click()
  await expect(first).toBeHidden()
  await page.getByRole('button', { name: 'Add customer', exact: true }).filter({ visible: true }).click()
  const second = page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
  await fill(second, `QA ledger second ${stamp}`, phone, `b${stamp}`)
  await second.getByRole('button', { name: 'Add Customer', exact: true }).click()
  await expect(page.getByText(/already uses this phone number/).first()).toBeVisible()
  expect(countByName((await apiLogin(SLUG)).user.tenantId, `QA ledger second ${stamp}`)).toBe(0)
})
