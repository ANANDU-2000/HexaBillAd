/**
 * Single source of truth for API base URL.
 * - Production (hostname !== localhost): never use localhost; use VITE_API_BASE_URL or default Render URL.
 * - Local (opened from localhost/127.0.0.1): use http://localhost:5000/api.
 * For production deploy: set VITE_API_BASE_URL in your build env (e.g. Vercel/Netlify) to your backend URL.
 */

const PRODUCTION_API = 'https://hexabill.onrender.com/api'
const LOCALHOST_API = 'http://localhost:5000/api'

function getApiBaseUrl() {
  const envApi = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (envApi && envApi.startsWith('http'))
    return envApi.endsWith('/api') ? envApi : envApi + '/api'
  const host = typeof window !== 'undefined' ? window.location?.hostname : ''
  if (host === 'localhost' || host === '127.0.0.1') return LOCALHOST_API
  return PRODUCTION_API
}

/** Base URL without /api suffix (for uploads, PDF links). */
function getApiBaseUrlNoSuffix() {
  const base = getApiBaseUrl()
  return base.endsWith('/api') ? base.replace(/\/api$/, '') : base
}

export { getApiBaseUrl, getApiBaseUrlNoSuffix, PRODUCTION_API, LOCALHOST_API }
