// Synthetic-only security smoke: each tenant token stays bound to its host and record scope.
import { test, expect } from '@playwright/test'
import { API, EDGE, TENANTS, apiLogin } from './session.js'

const headers = (slug, token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  'X-HexaBill-Original-Host': `${slug}.localhost`,
  'X-HexaBill-Edge-Secret': EDGE,
  ...extra,
})

async function get (slug, token, path, extra = {}) {
  return fetch(`${API}${path}`, { headers: headers(slug, token, extra) })
}

const rows = (json) => {
  const data = json?.data ?? json?.Data ?? []
  return data.items ?? data.Items ?? data.sales ?? data.Sales ?? data
}

test('tenant tokens cannot read another synthetic client or forge tenant scope', async () => {
  test.skip(TENANTS.length < 2, 'requires at least two synthetic tenants')
  const fixtures = new Map()
  for (const slug of TENANTS) {
    const session = await apiLogin(slug)
    const response = await get(slug, session.token, '/api/sales?page=1&pageSize=100')
    expect(response.status, `${slug} can read its own sales`).toBe(200)
    const sales = rows(await response.json())
    expect(sales.length, `${slug} has synthetic invoices`).toBeGreaterThan(0)
    fixtures.set(slug, { session, sales })
  }

  for (const [sourceSlug, source] of fixtures) {
    for (const [foreignSlug, foreign] of fixtures) {
      if (sourceSlug === foreignSlug) continue
      const foreignSale = foreign.sales[0]
      const sale = await get(sourceSlug, source.session.token, `/api/sales/${foreignSale.id}`)
      expect(sale.status, `${sourceSlug} cannot read ${foreignSlug}'s invoice`).toBe(404)
      const pdf = await get(sourceSlug, source.session.token, `/api/sales/${foreignSale.id}/pdf?layout=full`)
      expect(pdf.status, `${sourceSlug} cannot render ${foreignSlug}'s invoice PDF`).toBe(404)

      const hostMismatch = await get(foreignSlug, source.session.token, '/api/customers?page=1&pageSize=100')
      expect(hostMismatch.status, `${sourceSlug} token is rejected on ${foreignSlug}'s host`).toBe(403)
      const forgedTenant = await get(sourceSlug, source.session.token, '/api/customers?page=1&pageSize=100', {
        'X-Tenant-Id': String(foreign.session.user.tenantId),
      })
      expect(forgedTenant.status, `${sourceSlug} cannot override its host tenant`).toBe(403)
    }
  }
})
