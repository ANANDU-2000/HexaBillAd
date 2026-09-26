import { createPortal } from 'react-dom'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Overlay product drawer — does not shrink invoice table width.
 * Desktop: fixed right 480px; tablet/mobile: full-width sheet.
 */
export default function ProductDrawer({
  open,
  rowIndex,
  ownerRowId,
  searchValue,
  onSearchChange,
  onKeyDown,
  onClose,
  searchRef,
  loading,
  catalog,
  highlightIndex,
  onHighlight,
  onSelect,
  onPageChange,
  disabled,
}) {
  if (!open) return null
  const displayRow = rowIndex != null && rowIndex >= 0 ? rowIndex : 0

  const {
    pageItems = [],
    page = 0,
    totalPages = 1,
    recent = [],
    frequent = [],
    lastBilled = [],
    flat = [],
    start = 0,
  } = catalog || {}

  const searchTerm = (searchValue || '').trim()
  const recentIds = new Set(recent.map((p) => String(p.id)))
  const frequentIds = new Set(frequent.map((p) => String(p.id)))
  const lastIds = new Set(lastBilled.map((p) => String(p.id)))

  const panel = (
    <div className="fixed inset-0 z-[55] flex justify-end" data-product-picker="overlay">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 transition-opacity duration-150"
        aria-label="Close product drawer"
        onClick={onClose}
      />
      <aside
        className="relative w-full md:w-[480px] max-w-full h-full bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-[posDrawerIn_150ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label={`Product search row ${displayRow + 1}`}
        data-product-picker="desktop"
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-neutral-200 shrink-0 h-12">
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900">Products</p>
            <p className="text-[10px] text-neutral-500">Row {displayRow + 1} · F3 / Esc</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 min-h-[44px] min-w-[44px] md:min-h-8 md:min-w-8 md:p-1.5 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 px-3 py-2 border-b border-neutral-100 bg-neutral-50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              ref={searchRef}
              type="search"
              data-pos-control="search"
              data-pos-row-id={ownerRowId || ''}
              value={searchValue || ''}
              disabled={disabled}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search name, SKU, barcode…"
              className="w-full h-11 pl-9 pr-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus-visible:ring-2 disabled:opacity-50"
              aria-label="Search products"
              autoComplete="off"
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-1">↑↓ Enter · Esc · Recent / Frequent / Last billed</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 text-center text-sm text-neutral-500">Loading…</div>
          ) : flat.length === 0 ? (
            <div className="p-4 text-center text-sm text-neutral-500">No products found</div>
          ) : (
            (() => {
              let showedRecent = false
              let showedFrequent = false
              let showedLast = false
              let showedAll = false
              return pageItems.map((product, localIdx) => {
                const id = String(product.id)
                const headers = []
                if (!searchTerm && page === 0) {
                  if (recentIds.has(id) && !showedRecent) {
                    showedRecent = true
                    headers.push(
                      <div key="h-r" className="px-3 py-1 bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
                        Recent
                      </div>
                    )
                  } else if (frequentIds.has(id) && !showedFrequent) {
                    showedFrequent = true
                    headers.push(
                      <div key="h-f" className="px-3 py-1 bg-amber-50 text-[10px] font-semibold uppercase text-amber-800">
                        Frequent
                      </div>
                    )
                  } else if (lastIds.has(id) && !showedLast) {
                    showedLast = true
                    headers.push(
                      <div key="h-l" className="px-3 py-1 bg-emerald-50 text-[10px] font-semibold uppercase text-emerald-800">
                        Last billed
                      </div>
                    )
                  } else if (!recentIds.has(id) && !frequentIds.has(id) && !lastIds.has(id) && !showedAll) {
                    showedAll = true
                    headers.push(
                      <div key="h-a" className="px-3 py-1 bg-slate-50 text-[10px] font-semibold uppercase text-slate-600">
                        All products
                      </div>
                    )
                  }
                }
                return (
                  <div key={`${product.id}-${start + localIdx}`}>
                    {headers}
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-1.5 border-b border-neutral-100 hover:bg-slate-50 grid grid-cols-[1fr_auto] gap-x-2 items-center ${
                        highlightIndex === localIdx ? 'bg-primary-50 ring-1 ring-inset ring-primary-300' : ''
                      }`}
                      onMouseEnter={() => onHighlight?.(localIdx)}
                      onClick={() => onSelect?.(product)}
                    >
                      <p className="font-medium text-sm text-neutral-900 truncate col-span-2">{product.nameEn}</p>
                      <span className="text-xs text-neutral-600 tabular-nums">
                        AED {(product.sellPrice ?? 0).toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-semibold text-right tabular-nums ${
                          product.stockQty <= (product.reorderLevel || 0) ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {product.stockQty}
                      </span>
                      {product.sku && (
                        <span className="text-[10px] text-neutral-400 col-span-2 truncate">{product.sku}</span>
                      )}
                    </button>
                  </div>
                )
              })
            })()
          )}
        </div>

        {flat.length > 0 && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-neutral-200 bg-neutral-50">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => onPageChange?.(page - 1)}
              className="inline-flex items-center gap-0.5 px-3 py-2 text-xs font-medium border border-neutral-300 rounded-lg min-h-[44px] md:min-h-9 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <span className="text-xs text-neutral-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange?.(page + 1)}
              className="inline-flex items-center gap-0.5 px-3 py-2 text-xs font-medium border border-neutral-300 rounded-lg min-h-[44px] md:min-h-9 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
      <style>{`
        @keyframes posDrawerIn {
          from { transform: translateX(12px); opacity: 0.85; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )

  return createPortal(panel, document.body)
}
