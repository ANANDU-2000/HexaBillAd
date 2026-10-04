/**
 * @param {URLSearchParams} params
 * @param {{ businessDate?: string, branchId?: string }} state
 */
export function syncDailyCloseSearchParams (params, { businessDate, branchId }) {
  if (businessDate) params.set('date', businessDate)
  else params.delete('date')
  if (branchId) params.set('branchId', branchId)
  else params.delete('branchId')
}

/** @param {URLSearchParams} searchParams */
export function readDailyCloseStateFromParams (searchParams) {
  return {
    businessDate: searchParams.get('date') || null,
    branchId: searchParams.get('branchId') || ''
  }
}
