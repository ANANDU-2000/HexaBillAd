import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { pickerKey } from '../../utils/pickerNav'

// Product search combobox for the purchase voucher. The list is anchored inside the same
// relative wrapper as the input, sits above table headers, and selects on pointer-down so a
// touch tap is not lost to the input blur.
export default function ProductPicker({ inputRef, inputId, inputClassName, value, onChange, products, open, onOpenChange, onSelect }) {
  const wrapRef = useRef(null)
  const [active, setActive] = useState(-1)
  const listId = `${inputId}-list`

  useEffect(() => { setActive(-1) }, [products])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) onOpenChange(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onOpenChange])

  const visible = open && products.length > 0

  const onKeyDown = (e) => {
    const r = pickerKey(e.key, visible ? active : -1, products.length)
    if (r.action === 'close') { onOpenChange(false); return }
    if (r.action === 'open' || r.action === 'select') e.preventDefault()
    if (r.action === 'open' && !open) onOpenChange(true)
    if (r.action === 'select') { onSelect(products[r.active]); return }
    setActive(r.active)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${inputId}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder="Search products..."
        className={inputClassName}
        value={value}
        onChange={(e) => { onChange(e.target.value); onOpenChange(true) }}
        onFocus={() => onOpenChange(true)}
        onKeyDown={onKeyDown}
      />
      <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded border-2 border-neutral-200 bg-white shadow-lg md:max-w-xl"
        >
          {products.map((product, i) => (
            <li
              key={product.id}
              id={`${inputId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`min-h-11 cursor-pointer border-b border-neutral-100 p-2 ${i === active ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
              onPointerDown={(e) => { e.preventDefault(); onSelect(product) }}
              onMouseEnter={() => setActive(i)}
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.nameEn}</p>
                  <p className="text-xs text-primary-500">SKU: {product.sku}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">{formatCurrency(product.costPrice || 0)}</p>
                  <p className="text-xs text-primary-500">Stock: {product.stockQty}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
