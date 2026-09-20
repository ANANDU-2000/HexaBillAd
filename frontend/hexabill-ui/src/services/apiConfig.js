/**
 * Single source of truth for API base URL.
 * Default: same-origin /api (Vercel edge proxy in prod, Vite dev proxy locally).
 * Optional VITE_API_BASE_URL=http(s)://... for direct backend debugging only.
 */

const SAME_ORIGIN_API = '/api'

function getApiBaseUrl() {
  const envApi = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (envApi && envApi.startsWith('http'))
    return envApi.endsWith('/api') ? envApi : envApi + '/api'
  return SAME_ORIGIN_API
}

/** Base URL without /api suffix (for uploads, PDF links). */
function getApiBaseUrlNoSuffix() {
  const base = getApiBaseUrl()
  if (base === SAME_ORIGIN_API)
    return typeof window !== 'undefined' ? window.location.origin : ''
  return base.endsWith('/api') ? base.replace(/\/api$/, '') : base
}

export { getApiBaseUrl, getApiBaseUrlNoSuffix, SAME_ORIGIN_API }
