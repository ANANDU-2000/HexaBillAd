// Authentication safety (AU-02): lockout after repeated wrong passwords (temporary staff account, never the owner),
// an owner of one tenant cannot sign in on another tenant's address, and an invalid token sends the app to /login.
import { test, expect } from '@playwright/test'
import { feOrigin, apiLogin, API, EDGE, ownerPassword } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const OTHER = 'frozenhub1'
const hostHeaders = (slug) => ({ 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${slug}.localhost`, 'X-HexaBill-Edge-Secret': EDGE })
const login = (slug, email, password) => fetch(`${API}/api/auth/login`, { method: 'POST', headers: hostHeaders(slug), body: JSON.stringify({ email, password }) })

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, ...hostHeaders(SLUG), ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []

async function removeLeftoverTestStaff () {
  for (const u of items((await ownerApi('/api/users?page=1&pageSize=200')).json)) {
    if (/^UX (Staff|Role|Pay|Lock)/.test(u.name || '') && u.role?.toLowerCase() === 'staff') await ownerApi(`/api/users/${u.id}`, { method: 'DELETE' })
  }
}

test('five wrong passwords lock the account, and the right password is then refused with 429', async () => {
  await removeLeftoverTestStaff()
  const stamp = Date.now()
  const email = `ux-lock-${stamp}@hexabill.company`
  const password = `UxLock-${stamp}-Pass!`
  const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX Lock ${stamp}`, email, password, role: 'Staff', phone: null }) })
  expect(created.status, `create staff: ${JSON.stringify(created.json).slice(0, 160)}`).toBeLessThan(300)
  const id = created.json.data?.userId ?? created.json.data?.id ?? created.json.data?.Id
  try {
    expect((await login(SLUG, email, password)).status, 'the right password works first').toBe(200)
    for (let n = 1; n <= 5; n += 1) {
      expect((await login(SLUG, email, 'wrong-password-' + n)).status, `wrong attempt ${n}`).toBe(400)
    }
    const locked = await login(SLUG, email, password)
    expect(locked.status, 'locked even with the right password').toBe(429)
    expect(((await locked.json()).message || '')).toMatch(/too many failed attempts/i)
  } finally {
    if (id) await ownerApi(`/api/users/${id}`, { method: 'DELETE' })
  }
})

test('an owner of one tenant cannot sign in on another tenant\'s address', async () => {
  const res = await login(OTHER, `${SLUG}@hexabill.company`, ownerPassword())
  expect(res.status, 'refused on the other tenant').not.toBe(200)
  expect(res.status).toBeLessThan(500)
  // The same login still works on its own tenant.
  expect((await login(SLUG, `${SLUG}@hexabill.company`, ownerPassword())).status).toBe(200)
})

test('an invalid token sends the app to the login page and shows no data', async ({ page }) => {
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem('token', 'not.a.valid.token')
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'Owner', name: 'Expired', tenantId: 5 }))
  })
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('token')), 'the bad token is cleared').not.toBe('not.a.valid.token')
})
