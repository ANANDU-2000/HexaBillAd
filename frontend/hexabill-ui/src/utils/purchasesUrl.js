/**
 * @param {URLSearchParams} params
 * @param {{
 *   statusFilter?: string,
 *   filterPeriod?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   supplierSearch?: string,
 *   categoryFilter?: string,
 *   currentPage?: number
 * }} state
 */
export function syncPurchasesSearchParams (params, state) {
  const {
    statusFilter,
    filterPeriod,
    startDate,
    endDate,
    supplierSearch,
    categoryFilter,
    currentPage
  } = state
  if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
  else params.delete('status')
  if (filterPeriod && filterPeriod !== 'all') params.set('period', filterPeriod)
  else params.delete('period')
  if (startDate) params.set('startDate', startDate)
  else params.delete('startDate')
  if (endDate) params.set('endDate', endDate)
  else params.delete('endDate')
  if (supplierSearch) params.set('supplier', supplierSearch)
  else params.delete('supplier')
  if (categoryFilter) params.set('category', categoryFilter)
  else params.delete('category')
  if (currentPage > 1) params.set('page', String(currentPage))
  else params.delete('page')
}

/** @param {URLSearchParams} searchParams */
export function readPurchasesStateFromParams (searchParams) {
  return {
    currentPage: Number(searchParams.get('page')) || 1,
    filterPeriod: searchParams.get('period') || 'all',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    supplierSearch: searchParams.get('supplier') || '',
    categoryFilter: searchParams.get('category') || '',
    statusFilter: searchParams.get('status') || 'all'
  }
}
