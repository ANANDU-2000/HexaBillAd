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

function countCustomers (tenantId, name) {
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
  await form.getByRole('button', { name: 'Add Customer', exact: true }).click()
  const duplicate = page.getByRole('dialog').filter({ hasText: 'Duplicate phone or email' })
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
