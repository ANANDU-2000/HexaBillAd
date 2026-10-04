/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, method?: string, status?: string, customerId?: string | null }} state
 */
export function syncPaymentsSearchParams (params, { search, method, status, customerId }) {
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  if (method) params.set('method', method)
  else params.delete('method')
  if (status) params.set('status', status)
  else params.delete('status')
  if (customerId) params.set('customerId', String(customerId))
  else params.delete('customerId')
}

/** @param {URLSearchParams} searchParams */
export function readPaymentsStateFromParams (searchParams) {
  return {
    search: searchParams.get('search') || '',
    method: searchParams.get('method') || '',
    status: searchParams.get('status') || '',
    customerId: searchParams.get('customerId') || ''
  }
}

/** Deep link to global payments page (e.g. from customer list). */
export function buildPaymentsHref ({ customerId, search, method, status } = {}) {
  const params = new URLSearchParams()
  syncPaymentsSearchParams(params, {
    search,
    method,
    status,
    customerId: customerId != null && customerId !== '' ? String(customerId) : null
  })
  const q = params.toString()
  return q ? `/payments?${q}` : '/payments'
}
