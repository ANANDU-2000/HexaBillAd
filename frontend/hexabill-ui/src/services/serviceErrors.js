// Pure helpers for the API client's error handling (P0-02). Kept free of React/axios so they
// can be unit-tested with node --test.

/**
 * Classify a failed response so the UI can tell administrator maintenance apart from a server
 * that is starting, updating or unreachable. Only an explicit maintenance body counts as
 * maintenance; any other 503 is "unavailable".
 * @returns {'maintenance'|'unavailable'|'rateLimited'|'timeout'|'other'}
 */
export function classifyServiceError (status, data) {
  if (status === 503) {
    const body = data && typeof data === 'object' ? data : {}
    if (body.maintenanceMode === true || body.reason === 'MAINTENANCE_ENABLED') return 'maintenance'
    return 'unavailable'
  }
  if (status === 429) return 'rateLimited'
  if (status === 408 || status === 504) return 'timeout'
  return 'other'
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504])

function headerValue (headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') {
    const v = headers.get(name)
    if (v != null) return v
  }
  const wanted = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key]
  }
  return undefined
}

function bodyHasExternalReference (data) {
  let body = data
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return false }
  }
  if (!body || typeof body !== 'object') return false
  const ref = body.externalReference ?? body.ExternalReference
  return typeof ref === 'string' && ref.trim().length > 0
}

/** True when the server can de-duplicate a repeated write (Idempotency-Key header or POS externalReference). */
export function isIdempotentWrite (config) {
  if (!config) return false
  if (config._idempotent === true) return true
  const key = headerValue(config.headers, 'Idempotency-Key')
  if (typeof key === 'string' && key.trim()) return true
  return bodyHasExternalReference(config.data)
}

/**
 * May the client automatically resend this request after a transient failure?
 * Reads are always safe. Writes are resent only when the server de-duplicates them, so a lost
 * response can never create a second expense, purchase or return.
 * @param {object} config axios request config
 * @param {number|undefined} status HTTP status, or undefined for a network error/timeout
 */
export function isAutoRetryable (config, status) {
  if (!config || config._skipRetry) return false
  if (status === 401 || status === 403) return false
  if (status !== undefined && !RETRYABLE_STATUSES.has(status)) return false
  const method = String(config.method || 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return true
  if (method === 'DELETE') return false
  return isIdempotentWrite(config)
}

/**
 * While the client believes the server is unreachable it holds back background reads so a
 * restarting API is not flooded. A save the user just asked for is never held back silently:
 * it goes out, and a real network failure is then reported by the normal error path.
 */
export function shouldBlockWhileDisconnected (method) {
  return SAFE_METHODS.has(String(method || 'GET').toUpperCase())
}

/** Backoff for the recovery probe: 5s, 10s, 20s, 40s, then every 60s. */
export function nextProbeDelayMs (attempt) {
  return Math.min(60_000, 5_000 * 2 ** Math.max(0, attempt))
}

/**
 * Interpret a GET /api/maintenance-check probe. The endpoint sits behind the startup gate, so a
 * 503 means the server is still unavailable; a 200 says whether maintenance is on.
 * @returns {'ok'|'maintenance'|'unavailable'}
 */
export function interpretProbe (status, data) {
  if (status === 200) return data && (data.maintenanceMode === true || data.MaintenanceMode === true) ? 'maintenance' : 'ok'
  if (status === 503) return classifyServiceError(503, data) === 'maintenance' ? 'maintenance' : 'unavailable'
  return 'unavailable'
}
