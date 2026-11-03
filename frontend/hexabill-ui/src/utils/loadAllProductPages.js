// The POS picker search and barcode scan only see the products loaded into memory.
// The old POS load asked for 200 rows once, so any active product sorted past row 200 was unsearchable.
// GET /products honours pageSize (ProductService.GetProductsAsync has no cap), so walk every page up to maxPages.
export const PRODUCT_PAGE_SIZE = 200

export async function loadAllProductPages (getProducts, { pageSize = PRODUCT_PAGE_SIZE, maxPages = 25 } = {}) {
  const first = await getProducts({ page: 1, pageSize })
  if (!first?.success) throw new Error(first?.message || 'Failed to load products')
  const firstData = first.data || {}
  const reportedPages = Math.max(1, Number(firstData.totalPages) || 1)
  const totalCount = Number(firstData.totalCount) || (firstData.items?.length || 0)
  const totalPages = Math.min(reportedPages, maxPages)

  const rest = totalPages > 1
    ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => getProducts({ page: i + 2, pageSize })))
    : []

  // A failed page is an error, never a silently shorter list.
  const byId = new Map()
  for (const response of [first, ...rest]) {
    if (!response?.success) throw new Error(response?.message || 'Failed to load products')
    for (const product of response.data?.items || []) {
      if (product?.id != null && !byId.has(product.id)) byId.set(product.id, product)
    }
  }

  const items = [...byId.values()]
  return { items, totalCount, complete: reportedPages <= maxPages && items.length >= totalCount }
}
