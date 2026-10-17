// Payments role rules (PY-06): a staff login is sent away from /payments, and the API refuses a staff request to
// edit or delete a payment. Uses a temporary staff account that the test removes. No payment is created.
import { test, expect } from '@playwright/test'
import { feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

async function removeLeftoverTestStaff () {
  for (const u of items((await ownerApi('/api/users?page=1&pageSize=200')).json)) {
    if (/^UX (Staff|Role|Pay)/.test(u.name || '') && u.role?.toLowerCase() === 'staff') await ownerApi(`/api/users/${u.id}`, { method: 'DELETE' })
  }
}

test('payments: a staff login cannot open Payments or edit or delete a payment', async ({ page }) => {
  await removeLeftoverTestStaff()
  const stamp = Date.now()
  const email = `ux-pay-role-${stamp}@hexabill.company`
  const password = `UxPayRole-${stamp}-Pass!`
  const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX Pay ${stamp}`, email, password, role: 'Staff', phone: null }) })
  expect(created.status, `create staff: ${JSON.stringify(created.json).slice(0, 160)}`).toBeLessThan(300)
  const id = created.json.data?.userId ?? created.json.data?.id ?? created.json.data?.Id
  try {
    const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HOST }, body: JSON.stringify({ email, password }) })
    expect(login.status).toBe(200)
    const d = (await login.json()).data || {}
    const token = d.token || d.Token
    await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', JSON.stringify(s.user)) }, { token, user: { id: d.userId, role: 'Staff', name: d.name, tenantId: d.tenantId } })

    // Screen: the Payments route sends a staff user to the dashboard.
    await page.goto(`${feOrigin(SLUG)}/payments`, { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: /^Payments$/ })).toHaveCount(0)

    // API: the same user is refused for edit and delete (authorization runs before the payment is looked up).
    const asStaff = (path, init) => fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...HOST } })
    expect((await asStaff('/api/payments/999999', { method: 'DELETE' })).status, 'staff delete').toBe(403)
    expect((await asStaff('/api/payments/999999', { method: 'PUT', body: JSON.stringify({ amount: 1 }) })).status, 'staff edit').toBe(403)
  } finally {
    if (id) await ownerApi(`/api/users/${id}`, { method: 'DELETE' })
  }
})
