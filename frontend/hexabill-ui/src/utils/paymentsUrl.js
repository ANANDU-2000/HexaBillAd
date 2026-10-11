/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, method?: string, status?: string, customerId?: string | null, fromDate?: string, toDate?: string, page?: number }} state
 */
export function syncPaymentsSearchParams (params, { search, method, status, customerId, fromDate, toDate, page }) {
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  if (method) params.set('method', method)
  else params.delete('method')
  if (status) params.set('status', status)
  else params.delete('status')
  if (customerId) params.set('customerId', String(customerId))
  else params.delete('customerId')
  if (fromDate) params.set('fromDate', fromDate)
  else params.delete('fromDate')
  if (toDate) params.set('toDate', toDate)
  else params.delete('toDate')
  if (Number.isSafeInteger(page) && page > 1) params.set('page', String(page))
  else params.delete('page')
}

/** @param {URLSearchParams} searchParams */
export function readPaymentsStateFromParams (searchParams) {
  return {
    search: searchParams.get('search') || '',
    method: searchParams.get('method') || '',
    status: searchParams.get('status') || '',
    customerId: searchParams.get('customerId') || '',
    fromDate: validPaymentDate(searchParams.get('fromDate')),
    toDate: validPaymentDate(searchParams.get('toDate')),
    page: paymentListPage(searchParams.get('page'))
  }
}

/** Deep link to global payments page (e.g. from customer list). */
export function buildPaymentsHref ({ customerId, search, method, status, fromDate, toDate, page } = {}) {
  const params = new URLSearchParams()
  syncPaymentsSearchParams(params, {
    search,
    method,
    status,
    fromDate,
    toDate,
    page,
    customerId: customerId != null && customerId !== '' ? String(customerId) : null
  })
  const q = params.toString()
  return q ? `/payments?${q}` : '/payments'
}

const validPaymentDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}

const paymentListPage = (value) => {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 && page <= 1000000 ? page : 1
}

export function paymentDateRangeError ({ fromDate, toDate }) {
  return fromDate && toDate && fromDate > toDate ? 'From date must be on or before To date.' : ''
}

export function paymentListParams ({ page, search, method, status, fromDate, toDate }) {
  return {
    page: paymentListPage(page), pageSize: 25,
    search: (search || '').trim() || undefined,
    method: method || undefined, status: status || undefined,
    fromDate: fromDate || undefined, toDate: toDate || undefined
  }
}
