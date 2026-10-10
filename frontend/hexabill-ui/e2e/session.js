// Shared login for e2e specs. Signs in through the API the same way the app does
// (tenant resolved from the original host header), then seeds localStorage.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const API = process.env.HEXABILL_API || 'http://127.0.0.1:5000'
export const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret'
export const TENANTS = (process.env.HEXABILL_E2E_TENANTS || 'gulfharvest,frozenhub1,frozenhub2')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Password from env, or from the gitignored e2e/.env.local (HEXABILL_OWNER_PASSWORD=...). */
export function ownerPassword () {
  if (process.env.HEXABILL_OWNER_PASSWORD) return process.env.HEXABILL_OWNER_PASSWORD
  // fileURLToPath decodes %20 etc.; URL.pathname does not, which broke paths with spaces.
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.local')
  if (fs.existsSync(file)) {
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('HEXABILL_OWNER_PASSWORD='))
    if (line) return line.slice('HEXABILL_OWNER_PASSWORD='.length).trim()
  }
  return ''
}

export const feOrigin = (slug) => `http://${slug}.localhost:${process.env.HEXABILL_FE_PORT || 5173}`

const cache = new Map()

export async function apiLogin (slug) {
  if (cache.has(slug)) return cache.get(slug)
  const email = process.env[`HEXABILL_E2E_EMAIL_${slug.toUpperCase()}`] || `${slug}@hexabill.company`
  // Local SQLite can report "database is locked" when workers sign in at once; retry 5xx with backoff.
  let res
  for (let attempt = 1; attempt <= 5; attempt++) {
    res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HexaBill-Original-Host': `${slug}.localhost`,
        'X-HexaBill-Edge-Secret': EDGE,
      },
      body: JSON.stringify({ email, password: ownerPassword() }),
    })
    if (res.status < 500) break
    await new Promise((r) => setTimeout(r, 400 * attempt))
  }
  const json = await res.json().catch(() => ({}))
  const d = json?.data || json?.Data || {}
  const token = d.token || d.Token
  if (!res.ok || !token) throw new Error(`${slug} login failed (${res.status})`)
  const session = {
    token,
    user: {
      id: d.userId ?? d.UserId,
      role: d.role || d.Role || 'Owner',
      name: d.name || d.Name || 'User',
      companyName: d.companyName || d.CompanyName,
      dashboardPermissions: d.dashboardPermissions ?? d.DashboardPermissions ?? null,
      pageAccess: d.pageAccess ?? d.PageAccess ?? null,
      tenantId: d.tenantId ?? d.TenantId,
      assignedBranchIds: d.assignedBranchIds || d.AssignedBranchIds || [],
      assignedRouteIds: d.assignedRouteIds || d.AssignedRouteIds || [],
      mustChangePassword: false,
    },
  }
  cache.set(slug, session)
  return session
}

/** Open the tenant origin with an authenticated session already in storage. */
export async function signIn (page, slug) {
  const session = await apiLogin(slug)
  await page.goto(`${feOrigin(slug)}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, session)
  return session
}
