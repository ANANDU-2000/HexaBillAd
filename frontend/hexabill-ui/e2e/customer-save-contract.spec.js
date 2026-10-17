import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

function assertSyntheticTarget () {
  if (API !== 'http://127.0.0.1:5078'
      || process.env.PGHOST !== '127.0.0.1'
      || !/^hexabill_codex_browser_/.test(process.env.PGDATABASE || '')
      || !process.env.HEXABILL_QA_PSQL) {
    throw new Error('Requires the guarded synthetic browser host and disposable loopback PostgreSQL.')
  }
}

async function api (path, init = {}) {
  const session = await apiLogin(SLUG)
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
    },
  })
  expect(response.ok, `Synthetic API ${init.method || 'GET'} ${path}: ${response.status}`).toBeTruthy()
  return response.json()
}

// Once the tenant has a branch the form requires one; choose the first real branch so the spec works on either fixture state.
async function pickBranchIfRequired (form) {
  const branch = form.getByLabel(/^Branch/)
  if (await branch.count() === 0) return
  const value = await branch.locator('option').evaluateAll(opts => opts.map(o => o.value).find(v => v))
  if (value) await branch.selectOption(value)
  const route = form.locator('select[name="routeId"]')
  if (await route.count()) {
    const routeValue = await route.locator('option').evaluateAll(opts => opts.map(o => o.value).find(v => v))
    if (routeValue) await route.selectOption(routeValue)
  }
}

function countCustomers (tenantId, name) {
  if (!Number.isInteger(Number(tenantId)) || !/^QA (duplicate|terms|decimal|phone) \d+$/.test(name)) {
    throw new Error('Unexpected synthetic SQL lookup values.')
  }
  const sql = `SELECT count(*) FROM "Customers" WHERE "TenantId" = ${Number(tenantId)} AND "Name" = '${name}';`
  return Number(execFileSync(process.env.HEXABILL_QA_PSQL, ['-X', '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim())
}

test.beforeAll(async () => {
  assertSyntheticTarget()
  const response = await fetch(`${API}/__synthetic-host`)
  expect((await response.json()).syntheticOnly).toBe(true)
})

test('duplicate email confirmation saves blank optional values once and survives refresh', async ({ page }) => {
  const stamp = `${Date.now()}`
  const name = `QA duplicate ${stamp}`
  const phone = `050${stamp.slice(-7)}`
  const email = `qa-${stamp}@example.test`
  const session = await apiLogin(SLUG)
  await api('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ name: `QA existing ${stamp}`, phone: `051${stamp.slice(-7)}`, email, creditLimit: 0, customerType: 'Credit' }),
  })
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add customer', exact: true }).filter({ visible: true }).click()
  const form = page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
  await form.getByLabel(/Customer Name/).fill(name)
  await form.getByLabel(/Phone Number/).fill(phone)
  await form.getByLabel('Email Address').fill(email)
  await form.getByLabel('Address', { exact: true }).fill('Synthetic Arabic address: \u062f\u0628\u064a')
  await pickBranchIfRequired(form)
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  const duplicate = page.getByRole('dialog').filter({ hasText: 'Duplicate email' })
  await expect(duplicate).toBeVisible()
  expect(countCustomers(session.user.tenantId, name)).toBe(0)

  let posts = 0
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/customers$/.test(request.url())) posts++
  })
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/customers$/.test(response.url()))
  await duplicate.getByRole('button', { name: 'Add anyway', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  await expect(form).toBeHidden()
  await expect(page.getByText('Failed to save customer', { exact: true })).toHaveCount(0)
  expect(posts).toBe(1)
  expect(countCustomers(session.user.tenantId, name)).toBe(1)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customers' }).fill(name)
  await expect(page.getByRole('button', { name: `More actions for ${name}`, exact: true }).filter({ visible: true })).toHaveCount(1)
  const records = (await api(`/api/customers?search=${encodeURIComponent(name)}&pageSize=100`)).data.items
  const customer = records.find(item => item.name === name)
  expect(customer.phone).toBe(phone)
  expect(customer.creditLimit).toBe(0)
  expect(customer.email).toBe(email)
  expect(customer.address).toBe('Synthetic Arabic address: \u062f\u0628\u064a')
  expect(customer.mainLatitude ?? null).toBeNull()
  expect(customer.mainLongitude ?? null).toBeNull()
  expect(countCustomers(session.user.tenantId, name)).toBe(1)
})

test('positive-credit edit offers payment terms and preserves them after refresh', async ({ page }, info) => {
  const stamp = `${Date.now()}`
  const name = `QA terms ${stamp}`
  const created = await api('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ name, phone: `052${stamp.slice(-7)}`, creditLimit: 0, customerType: 'Credit' }),
  })
  const id = created.data.id
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers?search=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).filter({ visible: true }).click()
  await page.getByRole('menuitem', { name: 'Edit customer', exact: true }).click()
  const edit = page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
  await edit.getByLabel('Credit Limit', { exact: true }).fill('750.50')
  expect(await edit.getByLabel('Credit Limit', { exact: true }).evaluate(input => input.validity.stepMismatch)).toBe(false)
  await expect(edit.locator('select[name="paymentTerms"]')).toBeVisible()
  await edit.locator('select[name="paymentTerms"]').selectOption('Net 30')
  await pickBranchIfRequired(edit)
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === `/api/customers/${id}`)
  await edit.getByRole('button', { name: 'Update Customer', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(edit).toBeHidden()
  const customer = (await api(`/api/customers/${id}`)).data
  expect(customer.creditLimit).toBe(750.5)
  expect(customer.paymentTerms).toBe('Net 30')
  const session = await apiLogin(SLUG)
  const sql = `SELECT "CreditLimit"::text || '|' || "PaymentTerms" FROM "Customers" WHERE "Id" = ${Number(id)} AND "TenantId" = ${Number(session.user.tenantId)};`
  expect(execFileSync(process.env.HEXABILL_QA_PSQL, ['-X', '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim()).toMatch(/^750\.50\|Net 30$/)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).filter({ visible: true }).click()
  await page.getByRole('menuitem', { name: 'Edit customer', exact: true }).click()
  await expect(edit.getByLabel('Credit Limit', { exact: true })).toHaveValue('750.5')
  await expect(edit.locator('select[name="paymentTerms"]')).toHaveValue('Net 30')
  await page.screenshot({ path: info.outputPath('customer-terms-verified.png') })
})

test('fractional credit create rejects negatives and persists optional fields', async ({ page }) => {
  const stamp = `${Date.now()}`
  const name = `QA decimal ${stamp}`
  const phone = `053${stamp.slice(-7)}`
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add customer', exact: true }).filter({ visible: true }).click()
  const form = page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
  await form.getByLabel(/Customer Name/).fill(name)
  await form.getByLabel(/Phone Number/).fill(phone)
  const credit = form.getByLabel('Credit Limit', { exact: true })
  await credit.fill('-1')
  expect(await credit.evaluate(input => input.validity.rangeUnderflow)).toBe(true)
  await credit.fill('100.25')
  expect(await credit.evaluate(input => input.validity.stepMismatch)).toBe(false)
  await form.locator('select[name="paymentTerms"]').selectOption('Net 7')
  await form.getByLabel('TRN Number').fill('900000000000099')
  await form.getByLabel('Address', { exact: true }).fill('Synthetic A&B, \u062f\u0628\u064a')
  await form.getByLabel('Location (optional)', { exact: true }).fill('Synthetic zone')
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/customers$/.test(response.url()))
  await pickBranchIfRequired(form)
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  expect((await saved).status()).toBe(201)
  await expect(form).toBeHidden()
  const records = (await api(`/api/customers?search=${encodeURIComponent(name)}&pageSize=100`)).data.items
  const customer = records.find(item => item.name === name)
  expect(customer).toMatchObject({ name, phone, creditLimit: 100.25, paymentTerms: 'Net 7', trn: '900000000000099', address: 'Synthetic A&B, \u062f\u0628\u064a', location: 'Synthetic zone' })
  expect(customer.email || null).toBeNull()
  expect(countCustomers((await apiLogin(SLUG)).user.tenantId, name)).toBe(1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search customers' }).fill(name)
  await expect(page.getByRole('button', { name: `More actions for ${name}`, exact: true }).filter({ visible: true })).toHaveCount(1)
})

test('duplicate phone is blocked with the real reason and creates nothing', async ({ page }) => {
  const stamp = `${Date.now()}`
  const phone = `054${stamp.slice(-7)}`
  const name = `QA phone ${stamp}`
  const session = await apiLogin(SLUG)
  await api('/api/customers', { method: 'POST', body: JSON.stringify({ name: `QA phone owner ${stamp}`, phone, creditLimit: 0, customerType: 'Credit' }) })
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add customer', exact: true }).filter({ visible: true }).click()
  const form = page.getByRole('dialog').filter({ has: page.locator('input[name="name"]') })
  await form.getByLabel(/Customer Name/).fill(name)
  await form.getByLabel(/Phone Number/).fill(phone)
  await pickBranchIfRequired(form)
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  await expect(page.getByText(/already uses this phone number/).first()).toBeVisible()
  await expect(page.getByRole('dialog').filter({ hasText: 'Duplicate email' })).toHaveCount(0)
  expect(countCustomers(session.user.tenantId, name)).toBe(0)
  // The server, not only the page, must refuse it with a conflict rather than a server error.
  const raw = await fetch(`${API}/api/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, phone, creditLimit: 0, customerType: 'Credit' }),
  })
  expect(raw.status).toBe(409)
  expect(countCustomers(session.user.tenantId, name)).toBe(0)
})
