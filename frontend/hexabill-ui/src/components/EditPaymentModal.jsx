import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { paymentsAPI, customersAPI } from '../services'
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

function buildInvoiceOptions (outstandingInvoices = [], allInvoices = [], currentSaleId, currentInvoiceNo) {
  const map = new Map()
  for (const inv of outstandingInvoices) {
    if (inv?.id == null) continue
    map.set(inv.id, {
      id: inv.id,
      invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
      grandTotal: Number(inv.grandTotal ?? inv.total) || 0,
      balanceAmount: Number(inv.balanceAmount) || 0,
      isOutstanding: true
    })
  }
  for (const inv of allInvoices) {
    if (inv?.id == null || map.has(inv.id)) continue
    const grandTotal = Number(inv.grandTotal ?? inv.total) || 0
    const paidAmount = Number(inv.paidAmount) || 0
    const balanceAmount = grandTotal - paidAmount
    map.set(inv.id, {
      id: inv.id,
      invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
      grandTotal,
      balanceAmount,
      isOutstanding: balanceAmount > 0.005
    })
  }
  if (currentSaleId && !map.has(currentSaleId)) {
    map.set(currentSaleId, {
      id: currentSaleId,
      invoiceNo: currentInvoiceNo || `INV-${currentSaleId}`,
      grandTotal: 0,
      balanceAmount: 0,
      isOutstanding: false
    })
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.isOutstanding !== b.isOutstanding) return a.isOutstanding ? -1 : 1
    return String(b.invoiceNo).localeCompare(String(a.invoiceNo))
  })
}

/**
 * Compact edit payment modal — same field layout as Add Payment.
 * Save always PUTs updatePayment (never create / never auto-print).
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
  const [fetchedOutstanding, setFetchedOutstanding] = useState([])
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
  const invoices = useMemo(
    () => buildInvoiceOptions(effectiveOutstanding, allInvoices, currentSaleId, currentInvoiceNo),
    [effectiveOutstanding, allInvoices, currentSaleId, currentInvoiceNo]
  )

  useEffect(() => {
    if (!isOpen || !customerId || outstandingInvoices?.length) {
      if (!isOpen) setFetchedOutstanding([])
      return
    }
    let cancelled = false
    customersAPI.getOutstandingInvoices(customerId)
      .then((res) => {
        if (!cancelled) setFetchedOutstanding(res?.success ? (res.data || []) : [])
      })
      .catch(() => { if (!cancelled) setFetchedOutstanding([]) })
    return () => { cancelled = true }
  }, [isOpen, customerId, outstandingInvoices?.length])

  useEffect(() => {
    if (!isOpen || !payment) return
    setForm({
      amount: String(payment.amount ?? ''),
      paymentDate: toDateInputValue(payment.paymentDate),
      mode: normalizeMode(payment.method || payment.mode),
      reference: payment.ref || payment.reference || '',
      saleId: currentSaleId != null ? String(currentSaleId) : ''
    })
  }, [isOpen, payment, currentSaleId])

  const selectedInv = invoices.find((inv) => String(inv.id) === String(form.saleId))

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

    const prevSaleId = currentSaleId != null ? Number(currentSaleId) : null
    const saleChanged = (prevSaleId || null) !== (nextSaleId || null)

    setSaving(true)
    try {
      toast.loading('Updating payment...', { id: 'edit-payment' })
      const payload = {
        amount: amountValue,
        mode: modeUpper,
        reference: form.reference?.trim() || null,
        paymentDate: form.paymentDate
      }
      if (saleChanged) {
        payload.reassignSale = true
        payload.saleId = nextSaleId
      }
      const response = await paymentsAPI.updatePayment(payment.id, payload)
      if (response?.success) {
        toast.success('Payment updated successfully', { id: 'edit-payment' })
        // Parent onSaved reloads once — do not fire dataUpdated/paymentCreated (refresh storms).
        onSaved?.(response?.data || response)
        onClose?.()
      } else {
        toast.error(response?.message || 'Failed to update payment', { id: 'edit-payment' })
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update payment'
      if (!error?._handledByInterceptor) toast.error(errorMsg, { id: 'edit-payment' })
    } finally {
      setSaving(false)
    }
  }

  if (!payment) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose?.() }}
      title={`Edit Payment – ${payment.customerName || payment.customer?.name || 'Customer'}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date *</label>
            <input
              type="date"
              required
              max={new Date().toISOString().split('T')[0]}
              value={form.paymentDate}
              onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Invoice Number (Optional)</label>
            <select
              value={form.saleId}
              onChange={(e) => setForm((f) => ({ ...f, saleId: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              disabled={saving}
            >
              <option value="">-- No Invoice (General Payment) --</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={String(inv.id)}>
                  {inv.invoiceNo} - {formatCurrency(inv.grandTotal)} - {inv.balanceAmount > 0.005 ? `Balance: ${formatCurrency(inv.balanceAmount)}` : 'Paid'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Mode *</label>
            <select
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              disabled={saving}
            >
              {MODES.map((m) => (
                <option key={m} value={m}>{m === 'ONLINE' ? 'Online Transfer' : m.charAt(0) + m.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Reference / Remarks</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Cheque number, transaction reference, notes..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
              disabled={saving}
            />
          </div>
        </div>

        {selectedInv ? (
          <div className={`border rounded-lg p-3 text-sm ${selectedInv.isOutstanding ? 'bg-blue-50 border-blue-200' : 'bg-neutral-50 border-neutral-200'}`}>
            <p className="font-medium">{selectedInv.invoiceNo}</p>
            <p className="text-neutral-600 mt-0.5">
              Total {formatCurrency(selectedInv.grandTotal)}
              {selectedInv.balanceAmount > 0.005 ? ` · Balance ${formatCurrency(selectedInv.balanceAmount)}` : ' · Paid'}
            </p>
          </div>
        ) : (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-900">
            General payment — not linked to a specific invoice (same as Add Payment).
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
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
            {saving ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
