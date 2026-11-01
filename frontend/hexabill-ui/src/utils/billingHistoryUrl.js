import { isIsoDate, isPeriodId } from './businessDateRange.js'

export const BILLING_STATUS_FILTERS = ['all', 'paid', 'partial', 'unpaid', 'voided']
export const BILLING_SORTS = ['newest', 'oldest']

/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, page?: number, from?: string, to?: string, period?: string, status?: string, sort?: string }} state
 */
export function syncBillingHistorySearchParams (params, { search, page, from, to, period, status, sort }) {
  // The old source tabs (?tab=operating|legacy|all) are gone: never write or keep them.
  params.delete('tab')
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  const p = Number(page) || 1
  if (p > 1) params.set('page', String(p))
  else params.delete('page')
  // Presets are stored by name so a bookmarked "Week" stays a rolling week.
  const isCustom = !period || period === 'custom'
  if (period && period !== 'all') params.set('period', period)
  else params.delete('period')
  if (isCustom && from) params.set('from', from)
  else params.delete('from')
  if (isCustom && to) params.set('to', to)
  else params.delete('to')
  if (status && status !== 'all') params.set('status', status)
  else params.delete('status')
  if (sort && sort !== 'newest') params.set('sort', sort)
  else params.delete('sort')
}

/**
 * Read Billing History state from the URL. Deprecated `tab` values are ignored so an old
 * bookmark such as /billing-history?tab=operating still opens the full history.
 * @param {URLSearchParams} params
 */
export function readBillingHistorySearchParams (params) {
  const from = isIsoDate(params.get('from')) ? params.get('from') : ''
  const to = isIsoDate(params.get('to')) ? params.get('to') : ''
  const rawPeriod = params.get('period')
  const period = isPeriodId(rawPeriod) ? rawPeriod : (from || to ? 'custom' : 'all')
  const rawStatus = (params.get('status') || '').toLowerCase()
  const rawSort = (params.get('sort') || '').toLowerCase()
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1))
  return {
    search: params.get('search') || '',
    page,
    period,
    from: period === 'custom' ? from : '',
    to: period === 'custom' ? to : '',
    status: BILLING_STATUS_FILTERS.includes(rawStatus) ? rawStatus : 'all',
    sort: BILLING_SORTS.includes(rawSort) ? rawSort : 'newest',
    hadDeprecatedTab: params.has('tab'),
  }
}
