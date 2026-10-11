// Staff accounts: an owner creates a staff user through the form (confirmed through the API), a staff login
// cannot reach user management, and the owner removes a user who has no transactions. Synthetic local tenant only.
// Not covered here (blocked decision, see PREMIUM-UX-TRACKER, Staff): disabling a user who has transactions.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function api (path, init = {}, asUser = null) {
  const s = asUser || await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

// The plan caps staff accounts, so leftovers from a failed run block the next one. Only accounts with the test
// prefixes are removed; the seeded staff account is never touched.
async function removeLeftoverTestStaff () {
  const list = items((await api('/api/users?page=1&pageSize=200')).json)
  for (const u of list) {
    if (/^UX (Staff|Role)/.test(u.name || '') && u.role?.toLowerCase() === 'staff') {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
    }
  }
}

async function userByEmail (email) {
  return items((await api('/api/users?page=1&pageSize=200')).json).find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null
}

test('owner creates a staff user through the form, and removes it when it has no transactions', async ({ page }, info) => {
  await removeLeftoverTestStaff()
  const stamp = Date.now()
  const name = `UX Staff ${stamp}`
  const email = `ux-staff-${stamp}@hexabill.company`
  const password = `UxStaff-${stamp}-Pass!`
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /^Add User$/ }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Add User' }).first()
  await expect(dialog).toBeVisible()
  await dialog.locator('input[name="name"]').fill(name)
  await dialog.locator('input[name="email"]').fill(email)
  await dialog.locator('input[name="password"]').fill(password)
  await dialog.locator('select[name="role"]').selectOption('Staff')
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/users$/.test(r.url()))
  await dialog.getByRole('button', { name: 'Create User', exact: true }).click()
  const createdRes = await created
  if (createdRes.status() >= 300) throw new Error(`POST /api/users ${createdRes.status()}: ${await createdRes.text()}`)
  await expect(dialog).toBeHidden()

  // Persisted: the account exists with the role entered.
  await expect.poll(async () => (await userByEmail(email))?.role).toBe('Staff')

  // Remove the user (no transactions yet): gone from the API afterwards.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible()
  const user = await userByEmail(email)
  // The list shows the name (not the email): take the smallest row element that holds this name and a Delete button.
  // Desktop rows say "Delete User"; phone cards say "Delete".
  const deleteName = info.project.use.viewport.width < 768 ? 'Delete' : 'Delete User'
  const row = page.locator('tr, li, article, div').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: deleteName, exact: true }) }).last()
  await row.getByRole('button', { name: deleteName, exact: true }).filter({ visible: true }).first().click()
  const dialogDelete = page.getByRole('dialog').first()
  await expect(dialogDelete).toBeVisible()
  // The confirmation asks for the word DELETE before the button enables.
  await dialogDelete.getByRole('textbox', { name: 'Type DELETE here' }).fill('DELETE')
  const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && new RegExp(`/api/users/${user.id}$`).test(r.url()))
  await dialogDelete.getByRole('button', { name: 'Delete', exact: true }).click()
  expect((await removed).status()).toBeLessThan(300)
  await expect.poll(async () => userByEmail(email)).toBeNull()
})

test('a staff login cannot reach user management', async ({ page }) => {
  await removeLeftoverTestStaff()
  const stamp = Date.now()
  const email = `ux-staff-role-${stamp}@hexabill.company`
  const password = `UxStaffRole-${stamp}-Pass!`
  const created = await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: `UX Role ${stamp}`, email, password, role: 'Staff', phone: null }),
  })
  expect(created.status, `create staff: ${JSON.stringify(created.json).slice(0, 200)}`).toBeLessThan(300)
  const id = created.json.data?.id ?? created.json.data?.Id
  try {
    // Log in as that staff user through the API (the same way the login form does), then load the app as them.
    const login = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
      body: JSON.stringify({ email, password }),
    })
    expect(login.status).toBe(200)
    const d = (await login.json()).data || {}
    const staffSession = { token: d.token || d.Token, user: { id: d.userId, role: 'Staff', name: d.name, tenantId: d.tenantId } }
    await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', JSON.stringify(s.user)) }, staffSession)
    await page.goto(`${feOrigin(SLUG)}/users`, { waitUntil: 'networkidle' })
    // The page must not offer user management to a staff login.
    await expect(page.getByRole('button', { name: /^Add User$/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /^Users$/ })).toHaveCount(0)
  } finally {
    if (id) await api(`/api/users/${id}`, { method: 'DELETE' })
  }
})
