/**
 * @param {URLSearchParams} params
 * @param {{ searchTerm?: string, overdueOnly?: boolean, showDeactivated?: boolean, page?: number }} state
 */
export function syncSuppliersSearchParams (params, { searchTerm, overdueOnly, showDeactivated, page }) {
  const q = (searchTerm || '').trim()
  if (q) params.set('q', q)
  else params.delete('q')
  if (overdueOnly) params.set('overdue', '1')
  else params.delete('overdue')
  if (showDeactivated) params.set('inactive', '1')
  else params.delete('inactive')
  if (page > 1) params.set('page', String(page))
  else params.delete('page')
}

/** @param {URLSearchParams} searchParams */
export function readSuppliersStateFromParams (searchParams) {
  return {
    searchTerm: searchParams.get('q') || '',
    overdueOnly: searchParams.get('overdue') === '1',
    showDeactivated: searchParams.get('inactive') === '1',
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  }
}
