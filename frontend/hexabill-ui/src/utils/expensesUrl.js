/**
 * @param {URLSearchParams} params
 * @param {{ from?: string, to?: string, branchId?: string }} state
 */
export function syncExpensesSearchParams (params, { dateRange, branchId }) {
  if (dateRange?.from) params.set('from', dateRange.from)
  else params.delete('from')
  if (dateRange?.to) params.set('to', dateRange.to)
  else params.delete('to')
  if (branchId) params.set('branchId', branchId)
  else params.delete('branchId')
}

/** @param {URLSearchParams} searchParams */
export function readExpensesStateFromParams (searchParams) {
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  return {
    dateRange: from && to ? { from, to } : null,
    branchId: searchParams.get('branchId') || ''
  }
}

/** Petrol/cash expense context → daily close (business date = filter end date). */
export function buildDailyCloseHref ({ businessDate, branchId } = {}) {
  const params = new URLSearchParams()
  if (businessDate) params.set('date', businessDate)
  if (branchId) params.set('branchId', String(branchId))
  const q = params.toString()
  return q ? `/daily-close?${q}` : '/daily-close'
}
