import React, { useEffect, useState } from 'react'
import { X, Printer, RefreshCw, AlertTriangle, ShieldCheck, ShoppingBag } from 'lucide-react'
import { legacyAPI } from '../services/index'
import { formatCurrency } from '../utils/currency'

export default function LegacyPurchaseDetailModal({ purchaseId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [purchase, setPurchase] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen || !purchaseId) {
      setPurchase(null)
      setError(null)
      return
    }

    let isMounted = true
    async function fetchDetail() {
      try {
        setLoading(true)
        setError(null)
        const res = await legacyAPI.getPurchaseById(purchaseId)
        if (isMounted) {
          if (res?.success && res.data) {
            setPurchase(res.data)
          } else {
            setError(res?.message || 'Failed to load historical purchase details.')
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || err.message || 'Error loading purchase details.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchDetail()
    return () => { isMounted = false }
  }, [isOpen, purchaseId])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-sm border border-neutral-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-fg">
              STARPLUS HISTORICAL PURCHASE
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              ID #{purchaseId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !purchase}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:bg-neutral-200 hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600" />
              <p className="mt-3 text-sm text-neutral-600">Retrieving Starplus historical purchase...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-600 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
            </div>
          ) : purchase ? (
            <>
              {/* Disclaimer Notice */}
              <div className="rounded-xl border border-warning-border bg-warning-bg/70 p-3.5 text-xs text-warning-fg flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-warning-fg shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Historical Purchase Record:</span> Preserved from the Starplus Foodstuff Trading ERP system.
                  Maintained in read-only audit status with original line items, quantities, and supplier costs.
                </div>
              </div>

              {/* Purchase Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 rounded-xl p-4 border border-neutral-100 text-xs">
                <div>
                  <span className="text-neutral-500 block">Supplier</span>
                  <span className="font-bold text-sm text-neutral-900">{purchase.supplierName || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Invoice / Ref No</span>
                  <span className="font-semibold text-sm text-neutral-900">#{purchase.invoiceNo || purchase.externalReference || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Purchase Date</span>
                  <span className="font-semibold text-neutral-800">
                    {purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString('en-GB') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Expense Category</span>
                  <span className="font-medium text-neutral-800">{purchase.expenseCategory || 'Inventory'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                  Line Items ({purchase.items?.length || 0})
                </h4>
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-neutral-200 text-xs">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Product Name</th>
                        <th className="px-3 py-2 text-center font-semibold">Unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Unit Cost</th>
                        {purchase.vatTotal > 0 && <th className="px-3 py-2 text-right font-semibold">VAT</th>}
                        <th className="px-3 py-2 text-right font-semibold">Total (AED)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {(purchase.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-neutral-50/50">
                          <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-neutral-900">
                            {item.productName}
                          </td>
                          <td className="px-3 py-2 text-center text-neutral-600">{item.unitType || 'CRTN'}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-neutral-800">{item.qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatCurrency(item.unitCost)}</td>
                          {purchase.vatTotal > 0 && (
                            <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatCurrency(item.vatAmount || 0)}</td>
                          )}
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(purchase.subtotal || 0)}</span>
                  </div>
                  {purchase.vatTotal > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>VAT Total:</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(purchase.vatTotal || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-neutral-200 pt-2 text-sm font-bold text-neutral-900">
                    <span>Total Amount:</span>
                    <span className="text-primary-700 tabular-nums">{formatCurrency(purchase.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
