/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, page?: number, from?: string, to?: string }} state
 */
export function syncBillingHistorySearchParams (params, { search, page, from, to }) {
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  const p = Number(page) || 1
  if (p > 1) params.set('page', String(p))
  else params.delete('page')
  if (from) params.set('from', from)
  else params.delete('from')
  if (to) params.set('to', to)
  else params.delete('to')
}
