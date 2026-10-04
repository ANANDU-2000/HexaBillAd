/**
 * @param {URLSearchParams} params
 * @param {{ search?: string, activeTab?: string, currentPage?: number, editId?: string | null }} state
 */
export function syncCustomersSearchParams (params, { search, activeTab, currentPage, editId }) {
  const q = (search || '').trim()
  if (q) params.set('search', q)
  else params.delete('search')
  if (activeTab && activeTab !== 'all') params.set('tab', activeTab)
  else params.delete('tab')
  const p = Number(currentPage) || 1
  if (p > 1) params.set('page', String(p))
  else params.delete('page')
  if (editId) params.set('edit', String(editId))
  else params.delete('edit')
}

/** @param {URLSearchParams} searchParams */
export function readCustomersStateFromParams (searchParams) {
  return {
    search: searchParams.get('search') || '',
    activeTab: searchParams.get('tab') || 'all',
    currentPage: Number(searchParams.get('page')) || 1,
    editId: searchParams.get('edit') || ''
  }
}
