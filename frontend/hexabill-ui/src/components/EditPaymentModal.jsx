import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { paymentsAPI, customersAPI, reportsAPI } from '../services'
import { formatCurrency } from '../utils/currency'

const MODES = ['CASH', 'CHEQUE', 'ONLINE', 'CREDIT']

function toDateInputValue (d) {
  if (!d) return new Date().toISOString().split('T')[0]
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0]
  return date.toISOString().split('T')[0]
}

function normalizeMode (raw) {
  const s = String(raw || 'CASH').trim().toUpperCase()
  if (MODES.includes(s)) return s
  if (s === 'BANK' || s === 'CARD') return 'ONLINE'
  return 'CASH'
}

function normalizeInvoiceList (outstandingInvoices = [], allInvoices = [], currentSaleId, currentInvoiceNo) {
  const invoiceMap = new Map()

  outstandingInvoices.forEach((inv) => {
    if (inv?.id == null) return
    invoiceMap.set(inv.id, {
      ...inv,
      isOutstanding: true,
      balanceAmount: Number(inv.balanceAmount) || 0,
      grandTotal: Number(inv.grandTotal ?? inv.total) || 0,
      invoiceNo: inv.invoiceNo || `INV-${inv.id}`
    })
  })

  allInvoices.forEach((inv) => {
    if (inv?.id == null || invoiceMap.has(inv.id)) return
    const paidAmount = Number(inv.paidAmount) || 0
    const grandTotal = Number(inv.grandTotal ?? inv.total) || 0
    const balanceAmount = grandTotal - paidAmount
    invoiceMap.set(inv.id, {
      id: inv.id,
      invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
      invoiceDate: inv.invoiceDate || inv.date,
      grandTotal,
      paidAmount,
      balanceAmount,
      isOutstanding: balanceAmount > 0.005,
      paymentStatus: inv.paymentStatus || (balanceAmount > 0.005 ? 'Pending' : 'Paid')
    })
  })

  // Ensure current linked invoice appears even if missing from lists
  if (currentSaleId && !invoiceMap.has(currentSaleId)) {
    invoiceMap.set(currentSaleId, {
      id: currentSaleId,
      invoiceNo: currentInvoiceNo || `INV-${currentSaleId}`,
      grandTotal: 0,
      balanceAmount: 0,
      isOutstanding: false,
      paymentStatus: 'Linked'
    })
  }

  return Array.from(invoiceMap.values()).sort((a, b) => {
    if (a.isOutstanding !== b.isOutstanding) return a.isOutstanding ? -1 : 1
    return new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0)
  })
}

/**
 * Full-field customer payment edit. Save always PUTs updatePayment (never create).
 * Invoice can be reassigned like Add Payment (pending list + typed invoice lookup).
 */
export default function EditPaymentModal ({
  isOpen,
  payment,
  onClose,
  onSaved,
  outstandingInvoices = [],
  allInvoices = []
}) {
  const [saving, setSaving] = useState(false)
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [fetchedOutstanding, setFetchedOutstanding] = useState([])
  const [fetchedAll, setFetchedAll] = useState([])
  const [form, setForm] = useState({
    amount: '',
    paymentDate: '',
    mode: 'CASH',
    reference: '',
    saleId: ''
  })

  const currentSaleId = payment?.saleId || payment?.invoiceId || null
  const currentInvoiceNo = payment?.invoiceNo || payment?.saleInvoiceNo || null
  const customerId = payment?.customerId || payment?.customer?.id || null

  const effectiveOutstanding = outstandingInvoices?.length ? outstandingInvoices : fetchedOutstanding
  const effectiveAll = allInvoices?.length ? allInvoices : fetchedAll

  useEffect(() => {
    if (!isOpen || !customerId) {
      setFetchedOutstanding([])
      setFetchedAll([])
      return
    }
    if (outstandingInvoices?.length && allInvoices?.length) return

    let cancelled = false
    ;(async () => {
      try {
        const [outRes, salesRes] = await Promise.all([
          customersAPI.getOutstandingInvoices(customerId).catch(() => null),
          reportsAPI.getSalesReport({ customerId, page: 1, pageSize: 500 }).catch(() => null)
        ])
        if (cancelled) return
        if (!outstandingInvoices?.length) {
          setFetchedOutstanding(outRes?.success ? (outRes.data || []) : [])
        }
        if (!allInvoices?.length) {
          const items = salesRes?.success
            ? (salesRes.data?.items || salesRes.data || [])
            : []
          const list = Array.isArray(items) ? items : []
          setFetchedAll(list.filter((s) =>
            !customerId || s.customerId === customerId || parseInt(s.customerId, 10) === parseInt(customerId, 10)
          ))
        }
      } catch (_) {
        if (!cancelled) {
          setFetchedOutstanding([])
          setFetchedAll([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, customerId, outstandingInvoices?.length, allInvoices?.length])

  const availableInvoices = useMemo(
    () => normalizeInvoiceList(effectiveOutstanding, effectiveAll, currentSaleId, currentInvoiceNo),
    [effectiveOutstanding, effectiveAll, currentSaleId, currentInvoiceNo]
  )

  const filteredInvoices = useMemo(() => {
    const q = invoiceFilter.trim().toLowerCase()
    if (!q) return availableInvoices
    return availableInvoices.filter((inv) =>
      String(inv.invoiceNo || '').toLowerCase().includes(q) ||
      String(inv.id).includes(q)
    )
  }, [availableInvoices, invoiceFilter])

  useEffect(() => {
    if (!isOpen || !payment) return
    setInvoiceFilter('')
    setForm({
      amount: String(payment.amount ?? ''),
      paymentDate: toDateInputValue(payment.paymentDate),
      mode: normalizeMode(payment.method || payment.mode),
      reference: payment.ref || payment.reference || '',
      saleId: currentSaleId != null ? String(currentSaleId) : ''
    })
  }, [isOpen, payment, currentSaleId])

  // Typed invoice no. → select matching sale when unique exact / suffix match
  useEffect(() => {
    if (!isOpen) return
    const q = invoiceFilter.trim()
    if (!q) return
    const exact = availableInvoices.filter((inv) =>
      String(inv.invoiceNo || '').toLowerCase() === q.toLowerCase()
    )
    if (exact.length === 1) {
      setForm((f) => (f.saleId === String(exact[0].id) ? f : { ...f, saleId: String(exact[0].id) }))
      return
    }
    const endsWith = availableInvoices.filter((inv) =>
      String(inv.invoiceNo || '').toLowerCase().endsWith(q.toLowerCase())
    )
    if (endsWith.length === 1) {
      setForm((f) => (f.saleId === String(endsWith[0].id) ? f : { ...f, saleId: String(endsWith[0].id) }))
    }
  }, [invoiceFilter, availableInvoices, isOpen])

  const selectedInv = availableInvoices.find((inv) => String(inv.id) === String(form.saleId))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!payment?.id || saving) return

    const amountValue = parseFloat(form.amount)
    if (!form.amount || Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error('Enter a valid payment amount greater than zero.')
      return
    }
    if (!form.paymentDate) {
      toast.error('Payment date is required.')
      return
    }
    const modeUpper = normalizeMode(form.mode)
    if (!MODES.includes(modeUpper)) {
      toast.error('Select a valid payment mode.')
      return
    }

    const nextSaleId = form.saleId === '' || form.saleId == null ? null : parseInt(form.saleId, 10)
    if (form.saleId && Number.isNaN(nextSaleId)) {
      toast.error('Select a valid invoice.')
      return
    }

    setSaving(true)
    try {
      toast.loading('Updating payment...', { id: 'edit-payment' })
      const response = await paymentsAPI.updatePayment(payment.id, {
        amount: amountValue,
        mode: modeUpper,
        reference: form.reference?.trim() || null,
        paymentDate: form.paymentDate,
        reassignSale: true,
        saleId: nextSaleId
      })
      if (response?.success) {
        toast.success('Payment updated successfully', { id: 'edit-payment' })
        try {
          window.dispatchEvent(new CustomEvent('dataUpdated'))
          window.dispatchEvent(new CustomEvent('paymentUpdated', {
            detail: { customerId: payment.customerId, paymentId: payment.id }
          }))
        } catch (_) { /* ignore */ }
        onSaved?.(response?.data || response)
        onClose?.()
      } else {
        toast.error(response?.message || 'Failed to update payment', { id: 'edit-payment' })
      }
    } catch (error) {
      console.error('Error updating payment:', error)
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update payment'
      if (!error?._handledByInterceptor) toast.error(errorMsg, { id: 'edit-payment' })
    } finally {
      setSaving(false)
    }
  }

  if (!payment) return null

  const customerLabel = payment.customerName || payment.customer?.name || '—'
  const statusLabel = payment.status || payment.paymentStatus || '—'
  const selectOptions = filteredInvoices.length > 0 ? filteredInvoices : availableInvoices

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose?.() }}
      title="Edit Payment / Receipt"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-700 space-y-1">
          <p><span className="font-medium text-neutral-500">Customer:</span> {customerLabel}</p>
          <p><span className="font-medium text-neutral-500">Status:</span> {statusLabel}</p>
          <p className="text-xs text-neutral-500">Current amount: {formatCurrency(payment.amount)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Find invoice no.</label>
          <input
            type="text"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value)}
            placeholder="Type invoice number to filter / select"
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Invoice Number</label>
          <select
            value={form.saleId}
            onChange={(e) => {
              setForm((f) => ({ ...f, saleId: e.target.value }))
              setInvoiceFilter('')
            }}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
          >
            <option value="">-- No Invoice (On account) --</option>
            {selectOptions.map((inv) => (
              <option key={inv.id} value={String(inv.id)}>
                {inv.invoiceNo} - {formatCurrency(inv.grandTotal)} - {inv.balanceAmount > 0.005 ? `Balance: ${formatCurrency(inv.balanceAmount)}` : 'Paid'}
              </option>
            ))}
            {/* Keep current selection visible if filtered out */}
            {form.saleId && !selectOptions.some((i) => String(i.id) === String(form.saleId)) && selectedInv && (
              <option value={String(selectedInv.id)}>
                {selectedInv.invoiceNo} - {formatCurrency(selectedInv.grandTotal)} (current)
              </option>
            )}
          </select>
          <p className="mt-1 text-xs text-neutral-500">Pending bills listed first — same as Add Payment.</p>
        </div>

        {selectedInv && (
          <div className={`border rounded-lg p-3 text-sm ${selectedInv.isOutstanding ? 'bg-blue-50 border-blue-200' : 'bg-neutral-50 border-neutral-200'}`}>
            <p className="font-medium text-neutral-800">{selectedInv.invoiceNo}</p>
            <p className="text-neutral-600 mt-1">
              Total {formatCurrency(selectedInv.grandTotal)}
              {selectedInv.balanceAmount > 0.005
                ? ` · Outstanding ${formatCurrency(selectedInv.balanceAmount)}`
                : ' · Paid'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">Amount is not auto-changed when you switch invoice.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Amount (AED) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Date *</label>
          <input
            type="date"
            required
            max={new Date().toISOString().split('T')[0]}
            value={form.paymentDate}
            onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Mode *</label>
          <select
            value={form.mode}
            onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">CASH/ONLINE clear immediately; CHEQUE/CREDIT stay pending until cleared.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Reference</label>
          <input
            type="text"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="Cheque no / transaction ID (optional)"
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={saving}
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={() => { if (!saving) onClose?.() }}
            className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save / Update'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
