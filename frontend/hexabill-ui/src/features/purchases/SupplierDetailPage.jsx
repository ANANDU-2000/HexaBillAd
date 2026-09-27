import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Download, Banknote, Pencil, Trash2, Share2, FileDown } from 'lucide-react'
import { suppliersAPI, purchasesAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { getWhatsAppShareUrl } from '../../utils/whatsapp'
import toast from 'react-hot-toast'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import Modal from '../../components/Modal'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import { localDateString } from '../../utils/dateFormat'

const DISCOUNT_TYPES = ['Cash Discount', 'Free Products', 'Promotional Offer', 'Negotiated Discount']
const tabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'purchases', label: 'Bills' },
  { id: 'payments', label: 'Paid' }
]
const fieldClass = 'w-full h-11 sm:h-9 px-3 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3 text-sm font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-60'
const btnOutline = 'inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3 text-sm font-medium border border-neutral-300 rounded-md text-neutral-800 bg-white hover:bg-neutral-50 disabled:opacity-60'

function safeMessage(err, fallback) {
  if (err?._handledByInterceptor) return null
  const status = err?.response?.status
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'Supplier was not found.'
  if (status === 409) return 'That action conflicts with an existing record.'
  if (status === 422) return 'Please check the form and try again.'
  if (status === 429) return 'Too many requests. Wait a moment and try again.'
  if (status >= 500) return fallback
  const msg = err?.message || err?.response?.data?.message
  if (typeof msg === 'string' && msg && !/exception|sql|stack|tenant|npgsql/i.test(msg)) return msg
  return fallback
}

const SupplierDetailPage = () => {
  const { name } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canPay = isAdminOrOwner(user)
  const supplierName = name ? decodeURIComponent(name) : ''
  const backTo = location.state?.listQuery ? `/suppliers?${location.state.listQuery}` : '/suppliers'

  const [activeTab, setActiveTab] = useState('summary')
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showRecordPayment, setShowRecordPayment] = useState(() => searchParams.get('recordPayment') === '1')
  const [saving, setSaving] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: localDateString(new Date()),
    mode: 'Cash',
    reference: '',
    notes: ''
  })
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [preFillPayment, setPreFillPayment] = useState({ amount: '', reference: '' })
  const [showOverpaymentConfirm, setShowOverpaymentConfirm] = useState(false)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [editPaymentForm, setEditPaymentForm] = useState({ amount: '', paymentDate: '', mode: 'Cash', reference: '', notes: '' })
  const [savingEditPayment, setSavingEditPayment] = useState(false)
  const [showDeletePaymentConfirm, setShowDeletePaymentConfirm] = useState(false)
  const [deletePaymentId, setDeletePaymentId] = useState(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [supplierInfo, setSupplierInfo] = useState(null)
  const [recordEntryType, setRecordEntryType] = useState('payment')
  const [ledgerCreditForm, setLedgerCreditForm] = useState({
    amount: '',
    creditDate: localDateString(new Date()),
    creditType: 'Cash Discount',
    notes: ''
  })
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (supplierName) loadData()
  }, [supplierName, activeTab, appliedFrom, appliedTo])

  useEffect(() => {
    const urlAmount = searchParams.get('amount')
    const urlRef = searchParams.get('ref')
    if (urlAmount && parseFloat(urlAmount) > 0 && canPay) {
      setPaymentForm(prev => ({
        ...prev,
        amount: urlAmount,
        reference: urlRef ? decodeURIComponent(urlRef) : prev.reference
      }))
      setPreFillPayment({ amount: urlAmount, reference: urlRef ? decodeURIComponent(urlRef) : '' })
      setShowRecordPayment(true)
    }
  }, [canPay])

  const loadData = async () => {
    if (!supplierName) return
    try {
      setLoading(true)
      setLoadError('')
      try {
        const supplierRes = await suppliersAPI.getSupplier(supplierName)
        if (supplierRes?.success && supplierRes?.data) setSupplierInfo(supplierRes.data)
        else {
          setLoadError('Supplier was not found.')
          setSupplierInfo(null)
          setBalance(null)
          return
        }
      } catch (err) {
        setSupplierInfo(null)
        setBalance(null)
        if (err?.response?.status === 404) {
          setLoadError('Supplier was not found.')
          return
        }
        throw err
      }
      const balanceRes = await suppliersAPI.getSupplierBalance(supplierName)
      if (balanceRes?.success && balanceRes?.data) setBalance(balanceRes.data)
      const resPurchases = await purchasesAPI.getPurchases({ supplierName, pageSize: 100 })
      if (resPurchases?.success && resPurchases?.data?.items) setPurchases(resPurchases.data.items)
      else setPurchases([])
      if (activeTab === 'ledger' || activeTab === 'payments') {
        const from = activeTab === 'ledger' ? (appliedFrom || undefined) : undefined
        const to = activeTab === 'ledger' ? (appliedTo || undefined) : undefined
        const transactionsRes = await suppliersAPI.getSupplierTransactions(supplierName, from, to)
        if (transactionsRes?.success && Array.isArray(transactionsRes?.data)) setTransactions(transactionsRes.data)
        else setTransactions([])
      }
    } catch (error) {
      console.error(error)
      setLoadError('Could not load this supplier.')
      const msg = safeMessage(error, 'Could not load this supplier.')
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—')
  const payments = (transactions || []).filter(t => (t.type || '').toLowerCase() === 'payment')
  const outstandingBills = purchases.filter(p => (p.balanceAmount || 0) > 0 && (p.paymentStatus || '').toLowerCase() !== 'paid')
  const hasPayable = (balance?.netPayable || 0) > 0

  const startPay = (amount, reference) => {
    if (!canPay) return
    setPaymentForm(prev => ({ ...prev, amount: amount != null ? String(amount) : prev.amount, reference: reference ?? prev.reference }))
    setPreFillPayment({ amount: amount != null ? String(amount) : '', reference: reference || '' })
    setShowRecordPayment(true)
    setRecordEntryType('payment')
  }

  const applyDates = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      toast.error('From date must be on or before To date.')
      return
    }
    setAppliedFrom(draftFrom)
    setAppliedTo(draftTo)
  }

  const statementRange = () => {
    if (appliedFrom && appliedTo && appliedFrom > appliedTo) {
      toast.error('From date must be on or before To date.')
      return null
    }
    if ((appliedFrom && !appliedTo) || (!appliedFrom && appliedTo)) {
      toast.error('Choose both dates, then Apply.')
      return null
    }
    if (appliedFrom && appliedTo) return { from: appliedFrom, to: appliedTo, usedDefault: false }
    const to = localDateString(new Date())
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)
    return { from: localDateString(fromDate), to, usedDefault: true }
  }

  const downloadStatement = async (share) => {
    if (pdfLoading) return
    const range = statementRange()
    if (!range) return
    setPdfLoading(true)
    try {
      if (range.usedDefault) toast('Statement covers the last 30 days.')
      const blob = await suppliersAPI.getSupplierStatement(supplierName, range.from, range.to)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `supplier_statement_${(supplierName || 'supplier').replace(/\s+/g, '_')}_${range.from}_${range.to}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      if (share) {
        const message = `${supplierName} statement ${range.from} to ${range.to}. Outstanding ${formatCurrency(balance?.netPayable || 0)}. The PDF was downloaded. Attach that file in this chat.`
        window.open(getWhatsAppShareUrl(message, supplierInfo?.phone), '_blank', 'noopener,noreferrer')
        toast.success('PDF downloaded. Attach it in WhatsApp.')
      } else {
        toast.success('Statement PDF downloaded')
      }
    } catch (err) {
      console.error(err)
      const msg = safeMessage(err, 'Could not generate the statement.')
      if (msg) toast.error(msg)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExportCsv = () => {
    const headers = ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance']
    const rows = transactions.map(t => [
      formatDate(t.date),
      t.type,
      (t.reference || '').replace(/,/g, ' '),
      Number(t.debit || 0).toFixed(2),
      Number(t.credit || 0).toFixed(2),
      Number(t.balance || 0).toFixed(2)
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supplier_ledger_${(supplierName || 'export').replace(/\s/g, '_')}_${localDateString(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
  }

  const submitRecordPayment = async () => {
    if (saving) return
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error('Enter a valid amount')
      return
    }
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
        toast.success('Payment recorded. Bills and reports updated.')
        setShowRecordPayment(false)
        setShowOverpaymentConfirm(false)
        setPreFillPayment({ amount: '', reference: '' })
        setPaymentForm({ amount: '', paymentDate: localDateString(new Date()), mode: 'Cash', reference: '', notes: '' })
        await loadData()
      } else {
        const msg = res?.message
        toast.error(typeof msg === 'string' && !/exception|sql|stack/i.test(msg) ? msg : 'Could not record payment')
      }
    } catch (err) {
      const msg = safeMessage(err, 'Could not record payment')
      if (msg) toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const submitLedgerCredit = async () => {
    if (saving) return
    const amount = parseFloat(ledgerCreditForm.amount)
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error('Enter a valid amount')
      return
    }
    try {
      setSaving(true)
      const res = await suppliersAPI.createLedgerCredit(supplierName, {
        amount,
        creditDate: ledgerCreditForm.creditDate,
        creditType: ledgerCreditForm.creditType,
        notes: ledgerCreditForm.notes?.trim() || undefined
      })
      if (res?.success) {
        toast.success('Ledger credit recorded. Outstanding updated.')
        setShowRecordPayment(false)
        setLedgerCreditForm({ amount: '', creditDate: localDateString(new Date()), creditType: 'Cash Discount', notes: '' })
        setRecordEntryType('payment')
        await loadData()
      } else {
        const msg = res?.message
        toast.error(typeof msg === 'string' && !/exception|sql|stack/i.test(msg) ? msg : 'Could not record ledger credit')
      }
    } catch (err) {
      const msg = safeMessage(err, 'Could not record ledger credit')
      if (msg) toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (saving) return
    if (recordEntryType === 'ledgerCredit') {
      if (!ledgerCreditForm.creditType?.trim()) {
        toast.error('Select a vendor discount type')
        return
      }
      await submitLedgerCredit()
      return
    }
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error('Enter a valid amount')
      return
    }
    const outstanding = balance?.netPayable ?? 0
    if (outstanding > 0 && amount > outstanding) {
      setShowOverpaymentConfirm(true)
      return
    }
    await submitRecordPayment()
  }

  const openEditPayment = (t) => {
    if (!t?.paymentId || !canPay) return
    const d = t.date ? localDateString(new Date(t.date)) : localDateString(new Date())
    setEditingPayment(t)
    setEditPaymentForm({
      amount: String(t.credit ?? 0),
      paymentDate: d,
      mode: t.mode || 'Cash',
      reference: t.reference || '',
      notes: t.notes || ''
    })
    setShowEditPaymentModal(true)
  }

  const saveEditPayment = async (e) => {
    e.preventDefault()
    if (savingEditPayment || !editingPayment?.paymentId || !supplierName) return
    const amount = parseFloat(editPaymentForm.amount)
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error('Enter a valid amount')
      return
    }
    setSavingEditPayment(true)
    try {
      const res = await suppliersAPI.updatePayment(supplierName, editingPayment.paymentId, {
        amount,
        paymentDate: editPaymentForm.paymentDate,
        mode: editPaymentForm.mode,
        reference: editPaymentForm.reference?.trim() || undefined,
        notes: editPaymentForm.notes?.trim() || undefined
      })
      if (res?.success) {
        toast.success('Payment updated')
        setShowEditPaymentModal(false)
        setEditingPayment(null)
        loadData()
      } else toast.error('Could not update payment')
    } catch (err) {
      const msg = safeMessage(err, 'Could not update payment')
      if (msg) toast.error(msg)
    } finally {
      setSavingEditPayment(false)
    }
  }

  const confirmDeletePayment = async () => {
    if (deletingPayment || !deletePaymentId || !supplierName) return
    setDeletingPayment(true)
    try {
      const res = await suppliersAPI.deletePayment(supplierName, deletePaymentId)
      if (res?.success !== false) {
        toast.success('Payment deleted')
        setShowDeletePaymentConfirm(false)
        setDeletePaymentId(null)
        loadData()
      } else toast.error('Could not delete payment')
    } catch (err) {
      const msg = safeMessage(err, 'Could not delete payment')
      if (msg) toast.error(msg)
    } finally {
      setDeletingPayment(false)
    }
  }

  const goEdit = () => {
    const q = new URLSearchParams(location.state?.listQuery || '')
    q.set('edit', supplierName)
    q.set('fromDetail', '1')
    navigate(`/suppliers?${q.toString()}`)
  }

  if (!supplierName) {
    return (
      <div className={`w-full px-3 sm:px-4 py-4 ${mobilePageShellClass}`}>
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-primary-700 mb-3"><ArrowLeft className="h-4 w-4" /> Suppliers</Link>
        <p className="text-sm text-neutral-600">Supplier was not found.</p>
      </div>
    )
  }

  return (
    <div className={`w-full px-3 sm:px-4 py-3 pb-24 lg:pb-4 ${mobilePageShellClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Link to={backTo} className="inline-flex items-center justify-center h-11 w-11 sm:h-9 sm:w-9 text-neutral-700 hover:bg-neutral-100 rounded-md shrink-0" title="Back" aria-label="Back to suppliers">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 truncate">{supplierName}</h1>
          <p className="text-xs text-neutral-500">Supplier ledger</p>
        </div>
        {supplierInfo?.isActive === false && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Deactivated</span>}
        {canPay && supplierInfo?.id > 0 && (
          <button type="button" onClick={goEdit} className={btnOutline} aria-label="Edit supplier"><Pencil className="h-4 w-4" /> Edit</button>
        )}
        {canPay && hasPayable && (
          <button type="button" onClick={() => { setPreFillPayment({ amount: '', reference: '' }); setShowRecordPayment(v => !v) }} className={btnPrimary}>
            <Banknote className="h-4 w-4" /> Pay
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3 text-sm">
        <div>
          <p className="text-xs text-neutral-500">Outstanding</p>
          <p className={`tabular-nums font-semibold ${(balance?.netPayable || 0) > 0 ? 'text-amber-700' : 'text-neutral-900'}`}>{formatCurrency(balance?.netPayable || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Unpaid bills</p>
          <p className="tabular-nums font-semibold text-neutral-900">{outstandingBills.length}</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 mb-3" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 h-9 px-3 text-sm font-medium border-b-2 -mb-px ${activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && !balance ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-neutral-100 rounded" />)}
        </div>
      ) : loadError && !balance ? (
        <div className="py-8 text-center">
          <p className="text-sm text-neutral-700 mb-3">{loadError}</p>
          <button type="button" onClick={loadData} className={btnOutline}>Try again</button>
        </div>
      ) : (
        <>
          {canPay && showRecordPayment && (
            <form onSubmit={handleRecordPayment} className="mb-4 border border-neutral-200 rounded-lg bg-white p-3 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={recordEntryType === 'payment'} onChange={() => setRecordEntryType('payment')} /> Payment</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={recordEntryType === 'ledgerCredit'} onChange={() => setRecordEntryType('ledgerCredit')} /> Ledger credit</label>
              </div>
              {recordEntryType === 'payment' ? (
                <p className="text-xs text-neutral-500">
                  Applied to the oldest unpaid bills first. Outstanding {formatCurrency(balance?.netPayable || 0)}.
                  {preFillPayment.reference ? ` Amount is filled for invoice ${preFillPayment.reference}.` : ''}
                </p>
              ) : (
                <p className="text-xs text-neutral-500">A vendor discount reduces outstanding and appears on the ledger.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {recordEntryType === 'payment' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Amount *</label>
                      <input type="number" step="0.01" min="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Date *</label>
                      <input type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Mode</label>
                      <select value={paymentForm.mode} onChange={e => setPaymentForm({ ...paymentForm, mode: e.target.value })} className={fieldClass}>
                        <option value="Cash">Cash</option>
                        <option value="Bank">Bank</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Reference</label>
                      <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} className={fieldClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
                      <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} className={fieldClass} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Amount *</label>
                      <input type="number" step="0.01" min="0.01" required value={ledgerCreditForm.amount} onChange={e => setLedgerCreditForm({ ...ledgerCreditForm, amount: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Date *</label>
                      <input type="date" required value={ledgerCreditForm.creditDate} onChange={e => setLedgerCreditForm({ ...ledgerCreditForm, creditDate: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Type *</label>
                      <select value={ledgerCreditForm.creditType} onChange={e => setLedgerCreditForm({ ...ledgerCreditForm, creditType: e.target.value })} className={fieldClass}>
                        {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
                      <input type="text" value={ledgerCreditForm.notes} onChange={e => setLedgerCreditForm({ ...ledgerCreditForm, notes: e.target.value })} className={fieldClass} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => !saving && setShowRecordPayment(false)} className={btnOutline}>Cancel</button>
                <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          )}

          {activeTab === 'summary' && (
            <div className="bg-white border border-neutral-200 rounded-lg px-3 py-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Purchases</p>
                  <p className="tabular-nums font-medium text-neutral-900">{formatCurrency(balance?.totalPurchases || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Payments</p>
                  <p className={`tabular-nums font-medium ${(balance?.totalPayments || 0) > 0 ? 'text-green-700' : 'text-neutral-900'}`}>{formatCurrency(balance?.totalPayments || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Outstanding</p>
                  <p className={`tabular-nums font-medium ${(balance?.netPayable || 0) > 0 ? 'text-amber-700' : 'text-neutral-900'}`}>{formatCurrency(balance?.netPayable || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Last payment</p>
                  <p className="font-medium text-neutral-900">{formatDate(balance?.lastPaymentDate)}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-neutral-200 text-sm">
                <span className="text-xs text-neutral-600 mr-auto">
                  Purchases {formatCurrency(balance?.totalPurchases || 0)} · Paid {formatCurrency(balance?.totalPayments || 0)} · Outstanding {formatCurrency(balance?.netPayable || 0)}
                </span>
                <label className="text-xs text-neutral-600">
                  From
                  <input type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} className={`${fieldClass} mt-1 w-[9.5rem]`} aria-label="From date" />
                </label>
                <label className="text-xs text-neutral-600">
                  To
                  <input type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} className={`${fieldClass} mt-1 w-[9.5rem]`} aria-label="To date" />
                </label>
                <button type="button" onClick={applyDates} className={btnOutline}>Apply</button>
                <button type="button" onClick={() => downloadStatement(false)} disabled={pdfLoading} className={btnPrimary}>
                  <FileDown className="h-4 w-4" /> {pdfLoading ? 'Generating...' : 'Statement PDF'}
                </button>
                <button type="button" onClick={() => downloadStatement(true)} disabled={pdfLoading} className={btnOutline} aria-label="Share statement">
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <button type="button" onClick={handleExportCsv} className={btnOutline} aria-label="Export CSV">
                  <Download className="h-4 w-4" /> CSV
                </button>
              </div>
              <div className="md:hidden divide-y divide-neutral-100">
                {loading ? (
                  <div className="p-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-neutral-100 rounded" />)}</div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-center text-neutral-500 py-8">No ledger activity for this period.</p>
                ) : transactions.map((t, i) => (
                  <div key={`${t.date}-${t.type}-${t.reference}-${i}`} className="p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-neutral-900">{t.type}</p>
                      <p className="text-xs text-neutral-500">{formatDate(t.date)}</p>
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">{t.reference || '—'}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div><p className="text-neutral-500">Debit</p><p className="tabular-nums">{(t.debit || 0) > 0 ? formatCurrency(t.debit) : '—'}</p></div>
                      <div><p className="text-neutral-500">Credit</p><p className={`tabular-nums ${(t.credit || 0) > 0 ? 'text-green-700' : ''}`}>{(t.credit || 0) > 0 ? formatCurrency(t.credit) : '—'}</p></div>
                      <div><p className="text-neutral-500">Balance</p><p className={`tabular-nums font-medium ${t.balance < 0 ? 'text-red-700' : 'text-neutral-900'}`}>{formatCurrency(t.balance || 0)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Date</th>
                      <th className="text-left font-medium px-2 py-2">Type</th>
                      <th className="text-left font-medium px-2 py-2">Reference</th>
                      <th className="text-right font-medium px-2 py-2">Debit</th>
                      <th className="text-right font-medium px-2 py-2">Credit</th>
                      <th className="text-right font-medium px-2 py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="p-4"><div className="h-10 animate-pulse bg-neutral-100 rounded" /></td></tr>
                    ) : transactions.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-neutral-500">No ledger activity for this period.</td></tr>
                    ) : transactions.map((t, i) => (
                      <tr key={`${t.date}-${t.type}-${i}`} className="border-t border-neutral-100">
                        <td className="px-2 h-10">{formatDate(t.date)}</td>
                        <td className="px-2 h-10">{t.type}</td>
                        <td className="px-2 h-10">{t.reference || '—'}</td>
                        <td className="px-2 h-10 text-right tabular-nums">{(t.debit || 0) > 0 ? formatCurrency(t.debit) : '—'}</td>
                        <td className={`px-2 h-10 text-right tabular-nums ${(t.credit || 0) > 0 ? 'text-green-700' : ''}`}>{(t.credit || 0) > 0 ? formatCurrency(t.credit) : '—'}</td>
                        <td className={`px-2 h-10 text-right tabular-nums font-medium ${t.balance < 0 ? 'text-red-700' : 'text-neutral-900'}`}>{formatCurrency(t.balance || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="md:hidden divide-y divide-neutral-100">
                {outstandingBills.length === 0 ? (
                  <p className="text-sm text-center text-neutral-500 py-8">No outstanding bills.</p>
                ) : outstandingBills.map((p) => (
                  <div key={p.id} className="p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-neutral-900">{p.invoiceNo}</p>
                        <p className="text-xs text-neutral-500">{formatDate(p.purchaseDate)}</p>
                      </div>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded h-fit ${(p.paymentStatus || '').toLowerCase() === 'partial' ? 'bg-amber-50 text-amber-800' : 'bg-neutral-100 text-neutral-700'}`}>{p.paymentStatus || 'Unpaid'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div><p className="text-neutral-500">Total</p><p className="tabular-nums">{formatCurrency(p.totalAmount || 0)}</p></div>
                      <div><p className="text-neutral-500">Paid</p><p className={`tabular-nums ${(p.paidAmount || 0) > 0 ? 'text-green-700' : ''}`}>{(p.paidAmount || 0) > 0 ? formatCurrency(p.paidAmount) : formatCurrency(0)}</p></div>
                      <div><p className="text-neutral-500">Balance</p><p className="tabular-nums text-amber-700">{formatCurrency(p.balanceAmount || 0)}</p></div>
                    </div>
                    {canPay && (
                      <button type="button" onClick={() => startPay(p.balanceAmount || 0, p.invoiceNo || '')} className={`${btnPrimary} mt-2 w-full`}>Pay</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Invoice</th>
                      <th className="text-left font-medium px-2 py-2">Date</th>
                      <th className="text-right font-medium px-2 py-2">Total</th>
                      <th className="text-right font-medium px-2 py-2">Paid</th>
                      <th className="text-right font-medium px-2 py-2">Balance</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                      {canPay && <th className="text-right font-medium px-2 py-2">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingBills.length === 0 ? (
                      <tr><td colSpan={canPay ? 7 : 6} className="p-8 text-center text-neutral-500">No outstanding bills.</td></tr>
                    ) : outstandingBills.map(p => (
                      <tr key={p.id} className="border-t border-neutral-100">
                        <td className="px-2 h-10 font-medium">{p.invoiceNo}</td>
                        <td className="px-2 h-10">{formatDate(p.purchaseDate)}</td>
                        <td className="px-2 h-10 text-right tabular-nums">{formatCurrency(p.totalAmount || 0)}</td>
                        <td className={`px-2 h-10 text-right tabular-nums ${(p.paidAmount || 0) > 0 ? 'text-green-700' : ''}`}>{formatCurrency(p.paidAmount || 0)}</td>
                        <td className="px-2 h-10 text-right tabular-nums text-amber-700">{formatCurrency(p.balanceAmount || 0)}</td>
                        <td className="px-2 h-10">{p.paymentStatus || 'Unpaid'}</td>
                        {canPay && (
                          <td className="px-2 h-10 text-right">
                            <button type="button" onClick={() => startPay(p.balanceAmount || 0, p.invoiceNo || '')} className="text-sm font-medium text-primary-700">Pay</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="md:hidden divide-y divide-neutral-100">
                {payments.length === 0 ? (
                  <p className="text-sm text-center text-neutral-500 py-8">No payment history.</p>
                ) : payments.map((t, i) => (
                  <div key={t.paymentId ?? i} className="p-3 text-sm">
                    <div className="flex justify-between">
                      <p className="font-medium text-green-700 tabular-nums">{formatCurrency(t.credit || 0)}</p>
                      <p className="text-xs text-neutral-500">{formatDate(t.date)}</p>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">{t.reference || '—'} · {t.mode || '—'}</p>
                    <p className="text-xs text-neutral-500 mt-1">Balance after {formatCurrency(t.balance || 0)}</p>
                    {canPay && t.paymentId != null && (
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => openEditPayment(t)} className={btnOutline}><Pencil className="h-4 w-4" /> Edit</button>
                        <button type="button" onClick={() => { setDeletePaymentId(t.paymentId); setShowDeletePaymentConfirm(true) }} className="inline-flex items-center gap-1 h-11 px-3 text-sm border border-red-200 rounded-md text-red-700"><Trash2 className="h-4 w-4" /> Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Date</th>
                      <th className="text-left font-medium px-2 py-2">Reference</th>
                      <th className="text-left font-medium px-2 py-2">Mode</th>
                      <th className="text-right font-medium px-2 py-2">Amount</th>
                      <th className="text-right font-medium px-2 py-2">Balance after</th>
                      {canPay && <th className="text-right font-medium px-2 py-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={canPay ? 6 : 5} className="p-8 text-center text-neutral-500">No payment history.</td></tr>
                    ) : payments.map((t, i) => (
                      <tr key={t.paymentId ?? i} className="border-t border-neutral-100">
                        <td className="px-2 h-10">{formatDate(t.date)}</td>
                        <td className="px-2 h-10">{t.reference || '—'}</td>
                        <td className="px-2 h-10">{t.mode || '—'}</td>
                        <td className="px-2 h-10 text-right tabular-nums text-green-700">{formatCurrency(t.credit || 0)}</td>
                        <td className="px-2 h-10 text-right tabular-nums">{formatCurrency(t.balance || 0)}</td>
                        {canPay && (
                          <td className="px-2 h-10 text-right">
                            {t.paymentId != null ? (
                              <span className="inline-flex">
                                <button type="button" onClick={() => openEditPayment(t)} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100" aria-label="Edit payment"><Pencil className="h-4 w-4" /></button>
                                <button type="button" onClick={() => { setDeletePaymentId(t.paymentId); setShowDeletePaymentConfirm(true) }} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50" aria-label="Delete payment"><Trash2 className="h-4 w-4" /></button>
                              </span>
                            ) : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDangerModal
        isOpen={showOverpaymentConfirm}
        onClose={() => setShowOverpaymentConfirm(false)}
        onConfirm={() => submitRecordPayment()}
        title="Record overpayment?"
        message={balance ? `Amount (${formatCurrency(parseFloat(paymentForm.amount) || 0)}) exceeds outstanding (${formatCurrency(balance.netPayable)}). Record overpayment?` : ''}
        confirmLabel="Record overpayment"
      />

      <Modal isOpen={showEditPaymentModal} onClose={() => { if (!savingEditPayment) { setShowEditPaymentModal(false); setEditingPayment(null) } }} title="Edit payment" size="md">
        <form onSubmit={saveEditPayment} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Amount *</label>
            <input type="number" step="0.01" min="0.01" required value={editPaymentForm.amount} onChange={e => setEditPaymentForm(f => ({ ...f, amount: e.target.value }))} className={fieldClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Date *</label>
            <input type="date" required max={localDateString(new Date())} value={editPaymentForm.paymentDate} onChange={e => setEditPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} className={fieldClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Mode</label>
            <select value={editPaymentForm.mode} onChange={e => setEditPaymentForm(f => ({ ...f, mode: e.target.value }))} className={fieldClass}>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Reference</label>
            <input type="text" value={editPaymentForm.reference} onChange={e => setEditPaymentForm(f => ({ ...f, reference: e.target.value }))} className={fieldClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
            <input type="text" value={editPaymentForm.notes} onChange={e => setEditPaymentForm(f => ({ ...f, notes: e.target.value }))} className={fieldClass} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowEditPaymentModal(false); setEditingPayment(null) }} className={btnOutline}>Cancel</button>
            <button type="submit" disabled={savingEditPayment} className={btnPrimary}>{savingEditPayment ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        isOpen={showDeletePaymentConfirm}
        onClose={() => { if (!deletingPayment) { setShowDeletePaymentConfirm(false); setDeletePaymentId(null) } }}
        onConfirm={confirmDeletePayment}
        title="Delete payment?"
        message="This payment will be removed. The ledger and outstanding balance will be recalculated."
        confirmLabel={deletingPayment ? 'Deleting...' : 'Delete'}
      />
    </div>
  )
}

export default SupplierDetailPage
