/**
 * Local matrix / Tier-0 helper: when the browser is on 127.0.0.1/localhost
 * (marketing host) but a disposable tenant host is stored, attach the same
 * edge headers the Vite proxy would send for *.localhost.
 * Never active on real domains.
 */
export function resolveDevTenantHeaders (hostname, getItem) {
  const host = String(hostname || '').toLowerCase()
  if (host !== '127.0.0.1' && host !== 'localhost') return null
  if (typeof getItem !== 'function') return null
  const tenantHost = (getItem('hexabill_dev_tenant_host') || '').trim().toLowerCase()
  if (!tenantHost || !tenantHost.endsWith('.localhost')) return null
  const secret = (getItem('hexabill_dev_edge_secret') || 'dev-local-edge-secret').trim()
  return {
    'X-HexaBill-Original-Host': tenantHost,
    'X-HexaBill-Edge-Secret': secret,
  }
}

/**
 * Vite /api proxy: prefer a client-sent *.localhost Original-Host override
 * (loopback matrix) over the browser Host header (127.0.0.1).
 */
export function resolveProxyOriginalHost (browserHost, headerOverride) {
  const override = String(headerOverride || '').trim().toLowerCase()
  if (override.endsWith('.localhost')) return override
  return String(browserHost || '').split(':')[0].toLowerCase() || ''
}
