import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { paymentsAPI } from '../services'
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

/**
 * Full-field customer payment edit. Save always PUTs updatePayment (never create).
 * Payment is the source of truth for receipt print preview.
 */
export default function EditPaymentModal ({ isOpen, payment, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    paymentDate: '',
    mode: 'CASH',
    reference: ''
  })

  useEffect(() => {
    if (!isOpen || !payment) return
    setForm({
      amount: String(payment.amount ?? ''),
      paymentDate: toDateInputValue(payment.paymentDate),
      mode: normalizeMode(payment.method || payment.mode),
      reference: payment.ref || payment.reference || ''
    })
  }, [isOpen, payment])

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

    setSaving(true)
    try {
      toast.loading('Updating payment...', { id: 'edit-payment' })
      const response = await paymentsAPI.updatePayment(payment.id, {
        amount: amountValue,
        mode: modeUpper,
        reference: form.reference?.trim() || null,
        paymentDate: form.paymentDate
      })
      if (response?.success) {
        toast.success('Payment updated successfully', { id: 'edit-payment' })
        try {
          window.dispatchEvent(new CustomEvent('dataUpdated'))
          window.dispatchEvent(new CustomEvent('paymentCreated', {
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

  const invoiceLabel = payment.invoiceNo || payment.saleInvoiceNo || (payment.saleId ? `#${payment.saleId}` : 'On account')
  const customerLabel = payment.customerName || payment.customer?.name || '—'
  const statusLabel = payment.status || payment.paymentStatus || '—'

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
          <p><span className="font-medium text-neutral-500">Invoice:</span> {invoiceLabel}</p>
          <p><span className="font-medium text-neutral-500">Status:</span> {statusLabel}</p>
          <p className="text-xs text-neutral-500">Current amount: {formatCurrency(payment.amount)}</p>
        </div>

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
