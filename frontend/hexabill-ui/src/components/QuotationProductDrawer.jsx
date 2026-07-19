import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'

/**
 * Right-side product search for quotation line items (lighter than POS drawer).
 */
export default function QuotationProductDrawer({
  open,
  rowIndex,
  searchValue,
  onSearchChange,
  onClose,
  searchRef,
  loading,
  products = [],
  onSelect,
}) {
  if (!open) return null

  const panel = (
    <div className="fixed inset-0 z-[55] flex justify-end" data-quote-product-picker="overlay">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close product drawer" onClick={onClose} />
      <aside
        className="relative w-full md:w-[420px] max-w-full h-full bg-white shadow-2xl border-l border-neutral-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Product search row ${(rowIndex ?? 0) + 1}`}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <div>
            <p className="text-sm font-bold">Products</p>
            <p className="text-[10px] text-neutral-500">Row {(rowIndex ?? 0) + 1} · select to fill line</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 py-2 border-b bg-neutral-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              ref={searchRef}
              type="search"
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search name, SKU…"
              className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 text-center text-sm text-neutral-500">Loading…</div>
          ) : products.length === 0 ? (
            <div className="p-4 text-center text-sm text-neutral-500">No products found</div>
          ) : (
            products.map((product) => (
              <button
                key={product.id}
                type="button"
                className="w-full text-left px-3 py-2 border-b border-neutral-100 hover:bg-slate-50"
                onClick={() => onSelect?.(product)}
              >
                <p className="font-medium text-sm truncate">{product.nameEn || product.name || product.NameEn}</p>
                <div className="flex justify-between text-xs text-neutral-600 mt-0.5">
                  <span>AED {Number(product.sellPrice ?? product.SellPrice ?? 0).toFixed(2)}</span>
                  {(product.sku || product.Sku) && <span className="text-neutral-400">{product.sku || product.Sku}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  )

  return createPortal(panel, document.body)
}
