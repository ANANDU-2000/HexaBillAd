import { useState, useEffect } from 'react'
import { X, DollarSign, Download, Calendar, Filter } from 'lucide-react'
import Modal from './Modal'
import ConfirmDangerModal from './ConfirmDangerModal'
import { suppliersAPI } from '../services'
import { formatCurrency } from '../utils/currency'
import toast from 'react-hot-toast'

const SupplierLedgerModal = ({ isOpen, onClose, supplierName, onPaymentRecorded, initialShowRecordPayment }) => {
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showRecordPayment, setShowRecordPayment] = useState(!!initialShowRecordPayment)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    mode: 'Cash',
    reference: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [showOverpaymentConfirm, setShowOverpaymentConfirm] = useState(false)

  useEffect(() => {
    if (isOpen && supplierName) {
      loadData()
    }
  }, [isOpen, supplierName, fromDate, toDate])

  useEffect(() => {
    if (isOpen && initialShowRecordPayment) {
      setShowRecordPayment(true)
    } else if (!isOpen) {
      setShowRecordPayment(false)
    }
  }, [isOpen, initialShowRecordPayment])

  const loadData = async () => {
    if (!supplierName) return
    try {
      setLoading(true)
      const [balanceRes, transactionsRes] = await Promise.all([
        suppliersAPI.getSupplierBalance(supplierName),
        suppliersAPI.getSupplierTransactions(supplierName, fromDate || undefined, toDate || undefined)
      ])
      if (balanceRes?.success && balanceRes?.data) setBalance(balanceRes.data)
      if (transactionsRes?.success && transactionsRes?.data) setTransactions(transactionsRes.data)
    } catch (error) {
      toast.error('Failed to load supplier ledger')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const submitRecordPayment = async () => {
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) return
    try {
      setSaving(true)
      const res = await suppliersAPI.recordPayment(supplierName, {
        amount,
        paymentDate: paymentForm.paymentDate,
        mode: paymentForm.mode,
        reference: paymentForm.reference?.trim() || undefined,
        notes: paymentForm.notes?.trim() || undefined
      })
      if (res?.success) {
        toast.success('Payment recorded successfully')
        setShowRecordPayment(false)
        setShowOverpaymentConfirm(false)
        setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], mode: 'Cash', reference: '', notes: '' })
        loadData()
        onPaymentRecorded?.()
      } else {
        toast.error(res?.message || 'Failed to record payment')
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    const outstanding = balance?.netPayable ?? 0
    if (outstanding > 0 && amount > outstanding) {
      setShowOverpaymentConfirm(true)
      return
    }
    await submitRecordPayment()
  }

  const handleExportCsv = () => {
    const headers = ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance']
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString('en-GB'),
      t.type,
      t.reference || '',
      t.debit?.toFixed(2) || '0.00',
      t.credit?.toFixed(2) || '0.00',
      t.balance?.toFixed(2) || '0.00'
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supplier_ledger_${(supplierName || 'export').replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
  }

  if (!isOpen) return null

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Supplier Ledger: ${supplierName}`} size="lg" allowFullscreen>
      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-primary-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">Total Purchases</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(balance?.totalPurchases || 0)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="text-xs text-green-700 font-medium">Total Payments</p>
                <p className="text-lg font-bold text-green-900">{formatCurrency(balance?.totalPayments || 0)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Outstanding</p>
                <p className="text-lg font-bold text-amber-900">{formatCurrency(balance?.netPayable || 0)}</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                <p className="text-xs text-neutral-700 font-medium">Overdue</p>
                <p className="text-lg font-bold text-neutral-900">{formatCurrency(0)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-500" />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1 text-sm" placeholder="From" />
                <span className="text-primary-500">to</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1 text-sm" placeholder="To" />
              </div>
              <button onClick={handleExportCsv} className="flex items-center gap-1 px-2 py-1 bg-primary-100 hover:bg-primary-200 rounded text-sm">
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button onClick={() => setShowRecordPayment(true)} className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
                <DollarSign className="h-4 w-4" /> Record Payment
              </button>
            </div>

            {showRecordPayment && (
              <div className="bg-lime-50 border-2 border-lime-300 rounded-lg p-4">
                <h4 className="font-medium text-primary-800 mb-3">Record Payment</h4>
                <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-primary-700 mb-1">Amount (AED) *</label>
                    <input type="number" step="0.01" min="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary-700 mb-1">Date *</label>
                    <input type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary-700 mb-1">Mode</label>
                    <select value={paymentForm.mode} onChange={e => setPaymentForm({ ...paymentForm, mode: e.target.value })} className="w-full border rounded px-3 py-2">
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary-700 mb-1">Reference</label>
                    <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Cheque no, etc." />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-primary-700 mb-1">Notes</label>
                    <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Payment'}
                    </button>
                    <button type="button" onClick={() => setShowRecordPayment(false)} className="px-4 py-2 border rounded hover:bg-neutral-100">Cancel</button>
                  </div>
                </form>
                {(balance?.netPayable > 0 && parseFloat(paymentForm.amount) > balance.netPayable) && (
                  <p className="text-amber-600 text-xs mt-2">Amount exceeds outstanding ({formatCurrency(balance.netPayable)}). You may be overpaying.</p>
                )}
              </div>
            )}

            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary-100">
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Reference</th>
                    <th className="text-right p-2">Debit</th>
                    <th className="text-right p-2">Credit</th>
                    <th className="text-right p-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-primary-500">No transactions</td></tr>
                  ) : (
                    transactions.map((t, i) => (
                      <tr key={i} className="border-t border-primary-100 hover:bg-primary-50">
                        <td className="p-2">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                        <td className="p-2 font-medium">{t.type}</td>
                        <td className="p-2">{t.reference || '-'}</td>
                        <td className="p-2 text-right">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                        <td className="p-2 text-right">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(t.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDangerModal
      isOpen={showOverpaymentConfirm}
      onClose={() => setShowOverpaymentConfirm(false)}
      onConfirm={() => submitRecordPayment()}
      title="Record overpayment?"
      message={balance ? `Amount (${formatCurrency(parseFloat(paymentForm.amount) || 0)}) exceeds the outstanding balance (${formatCurrency(balance.netPayable)}). Are you sure you want to record this overpayment?` : ''}
      confirmLabel="Record overpayment"
    />
  </>
  )
}

export default SupplierLedgerModal
