import { X } from 'lucide-react'

/** Invoice-level discount popup (% / flat AED). Writes discount / discountInput only. */
export default function DiscountPopup({
  open,
  onClose,
  discountMode,
  setDiscountMode,
  discountInput,
  setDiscountInput,
  discountPercentInput,
  setDiscountPercentInput,
  discount,
  setDiscount,
  totals,
  vatPercent,
  disabled,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice discount"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="text-sm font-bold text-neutral-900">Invoice Discount</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-100" aria-label="Close">
            <X className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-1 p-0.5 bg-neutral-100 rounded-md">
            <button
              type="button"
              onClick={() => setDiscountMode('flat')}
              className={`flex-1 h-9 text-xs font-medium rounded ${discountMode === 'flat' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'}`}
            >
              Flat AED
            </button>
            <button
              type="button"
              onClick={() => setDiscountMode('percent')}
              className={`flex-1 h-9 text-xs font-medium rounded ${discountMode === 'percent' ? 'bg-white shadow text-neutral-900' : 'text-neutral-600'}`}
            >
              Percent %
            </button>
          </div>
          {discountMode === 'flat' ? (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Discount (AED)</label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                disabled={disabled}
                className="w-full h-10 px-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
                value={discountInput}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setDiscountInput(value)
                    const numValue = value === '' ? 0 : parseFloat(value)
                    setDiscount(isNaN(numValue) ? 0 : numValue)
                  }
                }}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Discount (%)</label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                disabled={disabled}
                className="w-full h-10 px-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                value={discountPercentInput}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setDiscountPercentInput(value)
                    const pct = value === '' ? 0 : parseFloat(value)
                    const amt = isNaN(pct) ? 0 : Math.round((totals.subtotal * (pct / 100)) * 100) / 100
                    setDiscount(amt)
                    setDiscountInput(amt === 0 ? '' : amt.toFixed(2))
                  }
                }}
              />
            </div>
          )}
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-600">Gross</span>
              <span className="font-semibold tabular-nums">AED {(totals.subtotal + totals.vatTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Discount</span>
              <span className="font-semibold text-red-600 tabular-nums">-AED {Number(discount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">VAT {vatPercent}%</span>
              <span className="font-semibold tabular-nums">AED {totals.vatTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-1.5">
              <span className="font-bold text-neutral-900">Net</span>
              <span className="font-bold tabular-nums">AED {totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 text-sm font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
