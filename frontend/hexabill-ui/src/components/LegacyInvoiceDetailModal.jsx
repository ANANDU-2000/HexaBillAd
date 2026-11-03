import React, { useEffect, useState } from 'react'
import { X, Printer, RefreshCw, AlertTriangle, ShieldCheck, FileText, CheckCircle2, Clock } from 'lucide-react'
import { legacyAPI, openLegacyInvoicePdf, legacyPdfErrorMessage } from '../services/index'
import { formatCurrency } from '../utils/currency'

export default function LegacyInvoiceDetailModal({ invoiceId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState(null)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState(null)

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setInvoice(null)
      setError(null)
      setPrintError(null)
      return
    }

    let isMounted = true
    async function fetchDetail() {
      try {
        setLoading(true)
        setError(null)
        const res = await legacyAPI.getInvoiceById(invoiceId)
        if (isMounted) {
          if (res?.success && res.data) {
            setInvoice(res.data)
          } else {
            setError(res?.message || 'Failed to load historical invoice details.')
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || err.message || 'Error loading invoice details.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchDetail()
    return () => { isMounted = false }
  }, [isOpen, invoiceId])

  if (!isOpen) return null

  // Printing uses the server A4 invoice PDF (same renderer as live invoices), never the browser page print.
  const handlePrint = async () => {
    setPrinting(true)
    setPrintError(null)
    try {
      await openLegacyInvoicePdf(invoiceId)
    } catch (err) {
      setPrintError(await legacyPdfErrorMessage(err, 'Could not generate the historical invoice PDF.'))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              STARPLUS HISTORICAL ARCHIVE
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              ID #{invoiceId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !invoice || printing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {printError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-900">
              {printError}
            </div>
          )}
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600" />
              <p className="mt-3 text-sm text-neutral-600">Retrieving Starplus historical invoice...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-600 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
            </div>
          ) : invoice ? (
            <>
              {/* Disclaimer Notice */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Historical Document Identity:</span> This invoice was originally issued by{' '}
                  <span className="font-semibold">{invoice.legacyIssuer || 'STARPLUS FOODSTUFF TRADING'}</span> under TRN{' '}
                  <span className="font-mono font-semibold">{invoice.sourceLegalTaxId || '100366253100003'}</span>. It is preserved
                  in read-only status and never re-branded under FrozenHub.
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 rounded-xl p-4 border border-neutral-100 text-xs">
                <div>
                  <span className="text-neutral-500 block">Invoice Number</span>
                  <span className="font-bold text-base text-neutral-900">#{invoice.legacyInvoiceNumber}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Invoice Date</span>
                  <span className="font-semibold text-neutral-800">
                    {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Customer</span>
                  <span className="font-semibold text-neutral-900 truncate block" title={invoice.customerName}>
                    {invoice.customerName || 'Walk-in / Cash Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Payment Status</span>
                  {invoice.outstandingCalculated <= 0.005 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Fully Settled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 mt-0.5">
                      <Clock className="h-3 w-3" /> Cutover Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Line Items</h4>
                  <span className="text-xs text-neutral-500">{invoice.items?.length || 0} items listed</span>
                </div>

                {invoice.items && invoice.items.length > 0 ? (
                  <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                    <table className="min-w-full divide-y divide-neutral-200 text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Unit</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">VAT</th>
                          <th className="px-3 py-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {invoice.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 text-neutral-900 font-medium">
                              <div>{item.productName}</div>
                              {item.sku && <span className="text-[10px] text-neutral-500 font-mono">SKU: {item.sku}</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-neutral-600">{item.unitType || 'PCS'}</td>
                            <td className="px-3 py-2 text-right font-medium text-neutral-900">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-neutral-700">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(item.vatAmount)}</td>
                            <td className="px-3 py-2 text-right font-bold text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto" />
                    <p className="mt-1 text-xs font-semibold text-amber-900">
                      Incomplete Source Data — Financial Totals Preserved from Starplus Ledger
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Original transaction line items were not present in the legacy export, but total amount ({formatCurrency(invoice.grandTotal)}) and payments are verified.
                    </p>
                  </div>
                )}
              </div>

              {/* Payments Section */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Historical Payment Records</h4>
                  <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                    <table className="min-w-full divide-y divide-neutral-200 text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Payment ID</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-center">Mode</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-left">Reference</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {invoice.payments.map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 font-mono text-neutral-700">#{p.sourcePaymentId}</td>
                            <td className="px-3 py-2 text-neutral-600">
                              {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="px-3 py-2 text-center font-medium text-neutral-800">{p.mode}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                (p.status || '').toUpperCase() === 'CLEARED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-neutral-500 font-mono text-[11px]">{p.reference || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Totals Card */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal (Excl. VAT):</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>VAT Total:</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(invoice.vatTotal)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Discount:</span>
                    <span className="font-medium text-rose-600">-{formatCurrency(invoice.discount)}</span>
                  </div>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Round-off:</span>
                    <span className="font-medium text-neutral-900">{formatCurrency(invoice.roundOff)}</span>
                  </div>
                )}
                <div className="border-t border-neutral-300 pt-2 flex justify-between text-sm font-bold text-neutral-900">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(invoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 font-medium">
                  <span>Total Paid:</span>
                  <span>{formatCurrency(invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-rose-700 border-t border-neutral-200 pt-1">
                  <span>Outstanding Balance:</span>
                  <span>{formatCurrency(invoice.outstandingCalculated)}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
