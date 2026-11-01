import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Search, Filter, AlertCircle, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, X, ArrowLeft, RefreshCw, DollarSign,
  Package, Calendar, ShieldAlert
} from 'lucide-react'
import { legacyAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'

const LegacyInvoicesPage = () => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reconciliation, setReconciliation] = useState(null)

  useEffect(() => {
    loadInvoices()
  }, [page, pendingOnly])

  useEffect(() => {
    loadReconciliation()
  }, [])

  const loadReconciliation = async () => {
    try {
      const res = await legacyAPI.getReconciliation()
      if (res?.success && res.data) {
        setReconciliation(res.data)
      }
    } catch (err) {
      console.warn('Reconciliation metrics not loaded', err)
    }
  }

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const params = {
        page,
        pageSize,
        search: searchTerm || undefined,
        pendingOnly: pendingOnly ? true : undefined
      }
      const res = await legacyAPI.getInvoices(params)
      if (res?.success && res.data) {
        setInvoices(res.data.items || [])
        setTotalCount(res.data.totalCount || 0)
        setTotalPages(res.data.totalPages || 1)
      } else {
        toast.error('Failed to load historical invoices')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error loading legacy archive')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    loadInvoices()
  }

  const openInvoiceDetail = async (id) => {
    try {
      setDetailLoading(true)
      setSelectedInvoice(null)
      const res = await legacyAPI.getInvoiceById(id)
      if (res?.success && res.data) {
        setSelectedInvoice(res.data)
      } else {
        toast.error('Failed to load invoice details')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error loading invoice details')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Disclaimer Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-900 tracking-wide uppercase">
              Starplus Foodstuff Trading — Historical Legacy Archive
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              These records are immutable historical data from Starplus (TRN: 100366253100003) migrated for reference and receivables cutover.
              They are isolated from current FrozenHub accounting, live inventory counts, and current-period UAE VAT returns (FTA Form 201).
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {reconciliation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Historical Total Sales</div>
            <div className="mt-1 text-xl font-bold text-neutral-900">{formatCurrency(reconciliation.activeGrandTotal)}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{reconciliation.activeInvoices?.toLocaleString()} active bills</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Historical Paid Total</div>
            <div className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(reconciliation.activePaidTotal)}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{reconciliation.clearedPayments?.toLocaleString()} cleared payments</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Cutover Receivables (Pending)</div>
            <div className="mt-1 text-xl font-bold text-rose-600">{formatCurrency(reconciliation.positiveOutstandingSum)}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{reconciliation.positiveOutstandingCount} pending bills</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Approved Customer Opening AR</div>
            <div className="mt-1 text-xl font-bold text-blue-600">{formatCurrency(reconciliation.customerOpeningReceivablesTotal)}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{reconciliation.customerOpeningReceivablesCount} customer opening balances</div>
          </div>
        </div>
      )}

      {/* Header and Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Historical Invoices</h1>
          <p className="text-sm text-neutral-500">5,109 historical Starplus invoices with complete line items and payment traces</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setPendingOnly(false); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              !pendingOnly
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            All Invoices ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => { setPendingOnly(true); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              pendingOnly
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
            }`}
          >
            Pending Only (93 Invoices)
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number (e.g. 6996, 2158), customer name, or notes..."
            className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition"
        >
          Search
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setPage(1); setTimeout(loadInvoices, 50); }}
            className="px-3 py-2 border border-neutral-300 bg-white text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50"
          >
            Clear
          </button>
        )}
      </form>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-neutral-400" />
            <p className="mt-2 text-sm text-neutral-500">Loading historical invoices from legacy archive...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-neutral-300" />
            <p className="mt-2 text-sm font-medium text-neutral-600">No historical invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/80 transition">
                    <td className="px-4 py-3 font-semibold text-neutral-900">
                      #{inv.legacyInvoiceNumber}
                      {inv.reportedAsPending && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800">
                          Cutover Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 text-xs">
                      {new Date(inv.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-neutral-800 font-medium max-w-[200px] truncate">
                      {inv.customerName || <span className="text-neutral-400 italic">Unassigned (Walk-in)</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-neutral-600">
                      {inv.itemCount > 0 ? (
                        `${inv.itemCount} item${inv.itemCount > 1 ? 's' : ''}`
                      ) : (
                        <span className="text-amber-600 font-medium">0 items (Source Incomplete)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${inv.outstandingCalculated > 0.005 ? 'text-rose-600' : 'text-neutral-400'}`}>
                      {inv.outstandingCalculated > 0.005 ? formatCurrency(inv.outstandingCalculated) : 'AED 0.00'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.outstandingCalculated <= 0.005 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openInvoiceDetail(inv.id)}
                        className="px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded hover:bg-primary-100 transition"
                      >
                        View Items
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50/50">
          <div className="text-xs text-neutral-500">
            Showing Page <span className="font-semibold text-neutral-900">{page}</span> of{' '}
            <span className="font-semibold text-neutral-900">{totalPages}</span> ({totalCount} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 border border-neutral-300 rounded bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-neutral-300 rounded bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {(selectedInvoice || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 p-6 space-y-6">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-neutral-900">
                    Legacy Invoice #{selectedInvoice?.legacyInvoiceNumber}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                    STARPLUS ARCHIVE ONLY
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Issued by {selectedInvoice?.legacyIssuer} (TRN: {selectedInvoice?.sourceLegalTaxId || 'N/A'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-neutral-400" />
                <p className="mt-2 text-sm text-neutral-500">Loading line items and payment records...</p>
              </div>
            ) : selectedInvoice && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-neutral-500 font-medium">Invoice Date:</span>
                    <p className="font-semibold text-neutral-900 mt-0.5">{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-medium">Customer:</span>
                    <p className="font-semibold text-neutral-900 mt-0.5">{selectedInvoice.customerName || 'Walk-in Cash'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-medium">Status:</span>
                    <p className="font-semibold text-neutral-900 mt-0.5">{selectedInvoice.status}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-medium">Outstanding:</span>
                    <p className="font-bold text-rose-600 mt-0.5">{formatCurrency(selectedInvoice.outstandingCalculated)}</p>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Package className="h-4 w-4 text-neutral-500" />
                    Original Invoice Items ({selectedInvoice.items?.length || 0})
                  </h3>
                  {selectedInvoice.items?.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      Note: This historical invoice was recorded in Starplus without line items. Financial grand total, paid amount, and tax balances are fully preserved from source records.
                    </div>
                  ) : (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-neutral-200 text-xs">
                        <thead className="bg-neutral-50 font-semibold text-neutral-600">
                          <tr>
                            <th className="px-3 py-2 text-left">SKU / Item</th>
                            <th className="px-3 py-2 text-center">Unit</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Discount</th>
                            <th className="px-3 py-2 text-right">VAT (5%)</th>
                            <th className="px-3 py-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {selectedInvoice.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50/50">
                              <td className="px-3 py-2 font-medium text-neutral-900">
                                <div>{it.productName}</div>
                                {it.sku && <div className="text-[10px] text-neutral-400 font-mono">{it.sku}</div>}
                              </td>
                              <td className="px-3 py-2 text-center text-neutral-600">{it.unitType}</td>
                              <td className="px-3 py-2 text-right font-medium text-neutral-900">{it.quantity}</td>
                              <td className="px-3 py-2 text-right text-neutral-700">{formatCurrency(it.unitPrice)}</td>
                              <td className="px-3 py-2 text-right text-neutral-500">{formatCurrency(it.discount)}</td>
                              <td className="px-3 py-2 text-right text-neutral-500">{formatCurrency(it.vatAmount)}</td>
                              <td className="px-3 py-2 text-right font-bold text-neutral-900">{formatCurrency(it.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>Subtotal:</span>
                      <span className="font-medium text-neutral-900">{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>VAT Total:</span>
                      <span className="font-medium text-neutral-900">{formatCurrency(selectedInvoice.vatTotal)}</span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Discount:</span>
                        <span className="font-medium text-emerald-600">-{formatCurrency(selectedInvoice.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-neutral-900 border-t pt-1.5">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(selectedInvoice.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Historical Paid:</span>
                      <span>{formatCurrency(selectedInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-rose-600 border-t pt-1">
                      <span>Outstanding Balance:</span>
                      <span>{formatCurrency(selectedInvoice.outstandingCalculated)}</span>
                    </div>
                  </div>
                </div>

                {/* Payments List */}
                {selectedInvoice.payments?.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Recorded Historical Payments ({selectedInvoice.payments.length})
                    </h3>
                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-neutral-200 text-xs">
                        <thead className="bg-neutral-50 font-semibold text-neutral-600">
                          <tr>
                            <th className="px-3 py-2 text-left">Payment Date</th>
                            <th className="px-3 py-2 text-left">Mode</th>
                            <th className="px-3 py-2 text-left">Reference</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {selectedInvoice.payments.map((p, pIdx) => (
                            <tr key={pIdx}>
                              <td className="px-3 py-2 text-neutral-700">{new Date(p.paymentDate).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-neutral-700">{p.mode}</td>
                              <td className="px-3 py-2 text-neutral-500 font-mono text-[10px]">{p.reference || '—'}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  p.status?.toUpperCase() === 'CLEARED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LegacyInvoicesPage

