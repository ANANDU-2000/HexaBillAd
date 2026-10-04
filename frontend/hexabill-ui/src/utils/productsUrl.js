/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, activeTab?: string, currentPage?: number, categoryId?: string }} state
 */
export function syncProductsSearchParams (params, { search, activeTab, currentPage, categoryId }) {
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  if (activeTab && activeTab !== 'all') params.set('tab', activeTab)
  else params.delete('tab')
  const p = Number(currentPage) || 1
  if (p > 1) params.set('page', String(p))
  else params.delete('page')
  if (categoryId) params.set('category', String(categoryId))
  else params.delete('category')
}

/** @param {URLSearchParams} searchParams */
export function readProductsStateFromParams (searchParams) {
  return {
    search: searchParams.get('search') || '',
    activeTab: searchParams.get('tab') || 'all',
    currentPage: Number(searchParams.get('page')) || 1,
    categoryId: searchParams.get('category') || ''
  }
}
