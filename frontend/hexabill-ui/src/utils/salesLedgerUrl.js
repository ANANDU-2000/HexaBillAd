export const SALES_LEDGER_FILTER_KEYS = [
  'date',
  'name',
  'type',
  'status',
  'invoiceNo',
  'branchId',
  'routeId',
  'staffId',
  'realPendingMin',
  'realPendingMax',
  'realGotPaymentMin',
  'realGotPaymentMax'
]

/**
 * @param {URLSearchParams} params
 * @param {{ from?: string, to?: string }} dateRange
 * @param {boolean} overdueOnly
 * @param {'newest' | 'oldest'} sortOrder
 * @param {Record<string, string>} filters
 */
export function syncSalesLedgerSearchParams (params, { dateRange, overdueOnly, sortOrder, filters }) {
  if (dateRange?.from) params.set('from', dateRange.from)
  else params.delete('from')
  if (dateRange?.to) params.set('to', dateRange.to)
  else params.delete('to')
  if (overdueOnly) params.set('overdue', '1')
  else params.delete('overdue')
  if (sortOrder) params.set('sort', sortOrder)
  else params.delete('sort')
  for (const key of SALES_LEDGER_FILTER_KEYS) {
    const v = filters?.[key]
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(key, String(v).trim())
    else params.delete(key)
  }
}

/** @param {URLSearchParams} searchParams */
export function readSalesLedgerStateFromParams (searchParams) {
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const sort = searchParams.get('sort')
  const filters = {}
  for (const key of SALES_LEDGER_FILTER_KEYS) {
    filters[key] = searchParams.get(key) || ''
  }
  return {
    dateRange: from && to ? { from, to } : null,
    overdueOnly: searchParams.get('overdue') === '1',
    sortOrder: sort === 'oldest' || sort === 'newest' ? sort : null,
    filters
  }
}
