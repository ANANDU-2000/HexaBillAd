// The server returns at most 100 customers per page (CustomerService.GetCustomersAsync), whatever pageSize asks for.
// Pages that need the full list (dropdowns, duplicate checks) must walk every page, not trust the first one.
export const SERVER_PAGE_SIZE = 100

export async function loadAllCustomerPages (getCustomers, { maxPages = 20, extraParams = {} } = {}) {
  const first = await getCustomers({ ...extraParams, page: 1, pageSize: SERVER_PAGE_SIZE })
  const firstData = first?.data
  const firstItems = firstData?.items || (Array.isArray(firstData) ? firstData : [])
  const totalPages = Math.min(Number(firstData?.totalPages) || 1, maxPages)
  if (totalPages <= 1) return { items: firstItems, complete: true, response: first }
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => getCustomers({ ...extraParams, page: i + 2, pageSize: SERVER_PAGE_SIZE }).catch(() => null))
  )
  const items = [...firstItems]
  let complete = (Number(firstData?.totalPages) || 1) <= maxPages
  for (const r of rest) {
    if (!r?.data?.items) { complete = false; continue }
    items.push(...r.data.items)
  }
  return { items, complete, response: first }
}
