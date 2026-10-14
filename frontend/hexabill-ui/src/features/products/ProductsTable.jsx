import { useMemo, useState } from 'react'
import ProductImage from '../../components/ProductImage'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, Edit, Eye, History, Image as ImageIcon, Package, Printer, RotateCw, Trash2 } from 'lucide-react'
import { OverflowMenu } from '../../components/ui/index'

const imageSrc = (url) => (url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`)

const expiryCell = (expiryDate) => {
  if (!expiryDate) return <span className="text-neutral-400">—</span>
  const d = new Date(expiryDate)
  const days = Math.ceil((d - new Date()) / 86400000)
  if (days < 0) return <span className="font-medium text-error">Expired</span>
  if (days <= 30) return <span className="font-medium text-orange-600">{days}d left</span>
  return <span className="text-neutral-600">{d.toLocaleDateString()}</span>
}

const COLUMNS = [
  { key: 'sku', label: 'SKU', className: 'w-36' },
  { key: 'nameEn', label: 'Product', className: '' },
  { key: 'barcode', label: 'Barcode', className: 'w-40' },
  { key: 'categoryName', label: 'Category', className: 'w-36' },
  { key: 'unitType', label: 'Unit', className: 'w-20' },
  { key: 'stockQty', label: 'Stock', className: 'w-24', align: 'right' },
  { key: 'sellPrice', label: 'Price', className: 'w-28', align: 'right' },
  { key: 'expiryDate', label: 'Expiry', className: 'w-28' },
]

/**
 * Dense ledger-style product list: one 36px row per product, checkbox selection,
 * three always-visible actions (View, Edit, Stock) and the rest in a "more" menu.
 */
export default function ProductsTable({
  products, loading, currency, selectedIds, onToggleOne, onTogglePage,
  canManageInventory, canAdjustStock,
  onAdjustStock, onDeactivate, onActivate, onPrintBarcode,
}) {
  const navigate = useNavigate()
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const rows = useMemo(() => {
    if (!sort.key) return products
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...products].sort((a, b) => {
      const x = a[sort.key]; const y = b[sort.key]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })
  }, [products, sort])

  const selectedOnPage = products.filter((p) => selectedIds.has(p.id)).length
  const allOnPage = products.length > 0 && selectedOnPage === products.length
  const someOnPage = selectedOnPage > 0 && !allOnPage

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }) : { key, dir: 'asc' }))

  return (
    <div className="rounded-lg border border-neutral-300 bg-white">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-neutral-100">
          <tr className="border-b border-neutral-300 text-[11px] uppercase tracking-wide text-neutral-600">
            <th className="w-10 px-3 py-2 text-left">
              <input
                type="checkbox"
                aria-label="Select all products on this page"
                className="h-4 w-4 rounded border-neutral-400 text-primary-600 focus:ring-primary-500"
                checked={allOnPage}
                ref={(el) => { if (el) el.indeterminate = someOnPage }}
                onChange={(e) => onTogglePage(e.target.checked)}
                disabled={!canManageInventory || products.length === 0}
              />
            </th>
            <th className="w-12 px-1 py-2" aria-label="Image" />
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-2 font-semibold ${c.className} ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className="inline-flex items-center gap-1 uppercase hover:text-neutral-900"
                >
                  {c.label}
                  {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
            ))}
            <th className="w-[8.5rem] px-2 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr><td colSpan={COLUMNS.length + 3} className="px-3 py-10 text-center text-neutral-500">Loading products…</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={COLUMNS.length + 3} className="px-3 py-10 text-center text-neutral-500">No products match these filters.</td></tr>
          )}
          {rows.map((p) => {
            const selected = selectedIds.has(p.id)
            const inactive = p.isActive === false
            const stock = p.stockQty ?? 0
            const low = stock <= (p.reorderLevel || 0)
            return (
              <tr
                key={p.id}
                onClick={() => navigate(`/products/${p.id}`)}
                className={`cursor-pointer border-b border-neutral-200 last:border-b-0 hover:bg-primary-50/50 ${selected ? 'bg-primary-50' : 'odd:bg-white even:bg-neutral-50/60'} ${inactive ? 'text-neutral-500' : 'text-neutral-900'}`}
              >
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.nameEn || p.sku}`}
                    className="h-4 w-4 rounded border-neutral-400 text-primary-600 focus:ring-primary-500"
                    checked={selected}
                    disabled={!canManageInventory}
                    onChange={() => onToggleOne(p.id)}
                  />
                </td>
                <td className="px-1 py-1.5">
                  {p.imageUrl ? (
                    <ProductImage productId={p.id} src={imageSrc(p.imageUrl)} alt="" className="h-8 w-8 rounded border border-neutral-200 object-cover" onError={(e) => { e.target.style.visibility = 'hidden' }} />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-neutral-200 bg-neutral-100"><ImageIcon className="h-4 w-4 text-neutral-400" /></span>
                  )}
                </td>
                <td className="truncate px-2 py-1.5 font-mono text-xs" title={p.sku}>{p.sku || '—'}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium text-primary-700" title={p.nameEn}>{p.nameEn}</span>
                    {inactive && <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">Inactive</span>}
                  </div>
                </td>
                <td className="truncate px-2 py-1.5 font-mono text-xs text-neutral-600" title={p.barcode || ''}>{p.barcode || <span className="text-neutral-400">—</span>}</td>
                <td className="truncate px-2 py-1.5" title={p.categoryName || ''}>{p.categoryName || <span className="text-neutral-400">—</span>}</td>
                <td className="px-2 py-1.5">{p.unitType || '—'}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${low ? 'font-semibold text-error' : ''}`}>
                  <span className="inline-flex items-center justify-end gap-1">
                    {low && <AlertTriangle className="h-3.5 w-3.5" aria-label="Low stock" />}
                    {stock}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{currency} {Number(p.sellPrice || 0).toFixed(2)}</td>
                <td className="px-2 py-1.5 text-xs">{expiryCell(p.expiryDate)}</td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <IconBtn label="View" onClick={() => navigate(`/products/${p.id}`)}><Eye className="h-4 w-4" /></IconBtn>
                    {canManageInventory && <IconBtn label="Edit" onClick={() => navigate(`/products/${p.id}?edit=1`)}><Edit className="h-4 w-4" /></IconBtn>}
                    {canAdjustStock && <IconBtn label="Adjust stock" onClick={() => onAdjustStock(p)}><Package className="h-4 w-4" /></IconBtn>}
                    <OverflowMenu
                      label={`More actions for ${p.nameEn}`}
                      items={[
                        { label: 'Print barcode', icon: Printer, hidden: !p.barcode, onClick: () => onPrintBarcode([p.id]) },
                        { label: 'Stock history', icon: History, hidden: !canAdjustStock, onClick: () => navigate(`/stock-adjustments?productId=${p.id}`) },
                        inactive
                          ? { label: 'Activate', icon: RotateCw, hidden: !canManageInventory, onClick: () => onActivate(p.id) }
                          : { label: 'Deactivate', icon: Trash2, danger: true, separatorBefore: true, hidden: !canManageInventory, onClick: () => onDeactivate([p]) },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IconBtn({ label, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      {children}
    </button>
  )
}
