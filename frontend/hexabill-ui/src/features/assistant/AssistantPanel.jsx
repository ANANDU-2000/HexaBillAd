import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  X, Maximize2, Minimize2, Search, UserPlus, Receipt, MessageSquare, Mic, Volume2,
  Sparkles, Send, CheckCircle2, Printer, ExternalLink, TrendingUp, AlertCircle, RefreshCw,
  SlidersHorizontal, ChevronDown, ChevronUp, Check, DollarSign, FileText, ArrowRight,
  ShieldCheck, ShoppingCart, User, Layers, ArrowUpRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { assistantApi } from './assistantApi'
import { describeChatReply, CHAT_MAX_CHARS, chatMessageProblem, prefillFor, ROUTE_TOOLS, routeRowDetail, routeMapLink } from './assistantChat'
import {
  VOICE_LANGUAGES, localeFor, recognitionCtor, ttsSupported, voiceOptedOut, setVoiceOptedOut, appendTranscript, describeVoiceError, readBackText, VOICE_PRIVACY_NOTE,
} from './voice'
import {
  canConfirm, describeConfirmFailure, emptyCustomerForm, emptyExpenseForm, fieldErrorMap, newIdempotencyKey, toDraftRequest, toExpenseDraftRequest,
} from './assistantDraft'
import { paymentsAPI, customersAPI } from '../../services'

const inputClass = 'block w-full min-h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500'
const surfaceCardClass = 'rounded-lg border border-neutral-200 bg-white p-3.5 shadow-sm text-neutral-900'

function formatAED(val) {
  const n = parseFloat(val)
  if (!Number.isFinite(n)) return '0.00 AED'
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
}

function speakUtterance(text, langId = 'en') {
  if (!ttsSupported(globalThis) || !text) return
  try {
    globalThis.speechSynthesis.cancel()
    const utterance = new globalThis.SpeechSynthesisUtterance(text)
    utterance.lang = localeFor(langId)
    globalThis.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn('TTS playback error:', err)
  }
}

// ==========================================
// ACTION EXECUTION CARDS
// ==========================================

function SummaryActionCard({ summary, asOf, onAskPrompt }) {
  if (!summary) {
    return <p className="text-sm text-neutral-600">No summary data available for today.</p>
  }
  const sales = summary.salesToday ?? 0
  const collections = summary.collectionsToday ?? 0
  const purchases = summary.purchasesToday ?? 0
  const expenses = summary.expensesToday ?? 0
  const profit = summary.profitToday
  const pendingAmount = summary.pendingBillsAmount ?? 0
  const pendingCount = summary.pendingBills ?? 0
  const lowStock = summary.lowStockCount ?? 0

  return (
    <div className={`${surfaceCardClass} space-y-3 border-l-4 border-l-primary-600`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900">
          <TrendingUp className="h-4 w-4 text-primary-600" />
          <span>Today's Business Summary</span>
        </div>
        {asOf && (
          <span className="text-xs text-neutral-400">
            {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Sales Today</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-primary-950">{formatAED(sales)}</p>
        </div>
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Received Today</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">{formatAED(collections)}</p>
        </div>
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Purchases Today</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-indigo-700">{formatAED(purchases)}</p>
        </div>
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Expenses Today</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-rose-700">{formatAED(expenses)}</p>
        </div>
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Profit Today</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">
            {profit != null ? formatAED(profit) : '— (Owner only)'}
          </p>
        </div>
        <div className="rounded border border-neutral-100 bg-neutral-50 p-2">
          <p className="text-[10px] uppercase font-semibold text-neutral-500">Pending Amount</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700">{formatAED(pendingAmount)}</p>
          {pendingCount > 0 && <span className="text-[10px] text-neutral-500">({pendingCount} bills)</span>}
        </div>
      </div>

      {lowStock > 0 && (
        <div className="flex items-center justify-between rounded bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            {lowStock} {lowStock === 1 ? 'item is' : 'items are'} running low on stock
          </span>
          <button
            type="button"
            onClick={() => onAskPrompt && onAskPrompt('Show low stock products')}
            className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
          >
            View items
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-2 text-xs">
        <Link to="/sales-ledger" className="text-primary-700 hover:text-primary-800 font-medium hover:underline">
          Sales Ledger &rarr;
        </Link>
        <span className="text-neutral-300">|</span>
        <Link to="/dashboard" className="text-primary-700 hover:text-primary-800 font-medium hover:underline">
          Full Dashboard &rarr;
        </Link>
      </div>
    </div>
  )
}

function PaymentActionCard({ fields = {}, language = 'en' }) {
  const [customerName, setCustomerName] = useState(fields.customerName || '')
  const [amount, setAmount] = useState(fields.amount || '')
  const [mode, setMode] = useState(fields.mode || 'CASH')
  const [reference, setReference] = useState(fields.reference || '')
  const [note, setNote] = useState(fields.note || '')

  const [busy, setBusy] = useState(false)
  const [postedResult, setPostedResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [matchedCustomer, setMatchedCustomer] = useState(null)

  // Quick customer search if user enters name
  useEffect(() => {
    if (!customerName || customerName.trim().length < 2 || matchedCustomer?.name === customerName) return
    let active = true
    customersAPI.searchCustomers(customerName.trim(), 5).then((res) => {
      if (!active) return
      const list = res?.data || []
      const found = list.find((c) => c.name.toLowerCase() === customerName.toLowerCase()) || list[0]
      if (found) setMatchedCustomer(found)
    }).catch(() => {})
    return () => { active = false }
  }, [customerName])

  const handlePost = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.')
      return
    }
    if (!customerName.trim() && !matchedCustomer) {
      setErrorMsg('Please specify customer name.')
      return
    }

    setBusy(true)
    setErrorMsg('')
    try {
      const idempotencyKey = newIdempotencyKey()
      const payload = {
        customerId: matchedCustomer ? matchedCustomer.id : null,
        amount: numAmount,
        mode: mode.toUpperCase(),
        reference: reference.trim() || undefined,
        paymentDate: new Date()
      }

      const res = await paymentsAPI.createPayment(payload, idempotencyKey)
      if (res?.success || res?.payment || res?.data) {
        const paymentData = res.data?.payment || res.payment || res.data || {}
        setPostedResult({
          id: paymentData.id || res.id,
          amount: numAmount,
          customer: matchedCustomer?.name || customerName,
          reference: reference || 'Direct AI Payment'
        })
        toast.success(`Payment of ${formatAED(numAmount)} posted successfully!`)
      } else {
        setErrorMsg(res?.message || 'Payment could not be posted. Please review details.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Payment failed. Please check customer ledger.')
    } finally {
      setBusy(false)
    }
  }

  const handleReadAloud = () => {
    const text = readBackText('new_payment', { customerName: matchedCustomer?.name || customerName, amount, mode, reference })
    speakUtterance(text, language)
  }

  if (postedResult) {
    return (
      <div className={`${surfaceCardClass} border-l-4 border-l-emerald-600 space-y-2.5`}>
        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Payment Recorded & Cleared</span>
        </div>
        <p className="text-xs text-neutral-700">
          <strong>{formatAED(postedResult.amount)}</strong> recorded for <strong>{postedResult.customer}</strong>.
          Balance has been updated automatically.
        </p>
        <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
          <Link
            to="/payments"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 underline"
          >
            Open in Payments &rarr;
          </Link>
          <span className="text-neutral-300">|</span>
          <Link
            to="/ledger"
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-800 underline"
          >
            Check Customer Ledger &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`${surfaceCardClass} border-l-4 border-l-emerald-600 space-y-3`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <span>Receive Payment Action</span>
        </div>
        {ttsSupported(globalThis) && (
          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700"
            title="Read back details aloud"
          >
            <Volume2 className="h-3.5 w-3.5" /> Read
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block font-medium text-neutral-700 mb-0.5">Customer Name *</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Al Noor Supermarket"
            value={customerName}
            onChange={(e) => { setCustomerName(e.target.value); setMatchedCustomer(null) }}
          />
          {matchedCustomer && (
            <p className="mt-0.5 text-[11px] text-emerald-700 font-medium">
              Matched customer: {matchedCustomer.name} (Balance: {formatAED(matchedCustomer.balance || 0)})
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Amount (AED) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Payment Mode</label>
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="CASH">CASH</option>
              <option value="ONLINE">ONLINE / BANK</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Reference #</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Cheque # / Trx ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Note</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Optional memo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </div>

      {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
        <button
          type="button"
          onClick={handlePost}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Posting Payment...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Confirm & Post Payment</span>
            </>
          )}
        </button>
      </div>
      <p className="text-[10px] text-neutral-500">
        Zero silent writes: payment is recorded in ledger with idempotency check only when you tap Confirm.
      </p>
    </div>
  )
}

function InvoiceDraftActionCard({ fields = {}, language = 'en' }) {
  const navigate = useNavigate()
  const customerName = fields.customerName || ''
  const items = fields.items || ''
  const amount = fields.amount || ''
  const paymentMethod = fields.paymentMethod || 'Cash'

  const handleOpenPos = () => {
    const params = new URLSearchParams()
    if (customerName) params.set('customer', customerName)
    if (items) params.set('draftItems', items)
    navigate(`/pos?${params.toString()}`)
  }

  const handleReadAloud = () => {
    const text = readBackText('new_sale', { customerName, items, amount })
    speakUtterance(text, language)
  }

  return (
    <div className={`${surfaceCardClass} border-l-4 border-l-indigo-600 space-y-3`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900">
          <ShoppingCart className="h-4 w-4 text-indigo-600" />
          <span>New Invoice Draft Action</span>
        </div>
        {ttsSupported(globalThis) && (
          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700"
            title="Read back details aloud"
          >
            <Volume2 className="h-3.5 w-3.5" /> Read
          </button>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        {customerName && (
          <div className="flex justify-between py-1 border-b border-neutral-50">
            <span className="text-neutral-500">Customer</span>
            <span className="font-semibold text-neutral-900">{customerName}</span>
          </div>
        )}
        {items && (
          <div className="flex justify-between py-1 border-b border-neutral-50">
            <span className="text-neutral-500">Items / Particulars</span>
            <span className="font-medium text-neutral-800 text-right max-w-[65%]">{items}</span>
          </div>
        )}
        {amount && (
          <div className="flex justify-between py-1 border-b border-neutral-50">
            <span className="text-neutral-500">Estimated Total</span>
            <span className="font-bold text-neutral-950 tabular-nums">{formatAED(amount)}</span>
          </div>
        )}
        <div className="flex justify-between py-1">
          <span className="text-neutral-500">Tender Method</span>
          <span className="font-medium text-neutral-800">{paymentMethod}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-neutral-100">
        <button
          type="button"
          onClick={handleOpenPos}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span>Open in POS & Finish Bill</span>
        </button>
      </div>
      <p className="text-[10px] text-neutral-500">
        Invoice items and customer pre-fill directly in POS for your final barcode scan and print.
      </p>
    </div>
  )
}

function ExpenseActionCard({ fields = {}, language = 'en' }) {
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(fields.amount || '')
  const [date, setDate] = useState(fields.date || new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState(fields.note || '')

  const [busy, setBusy] = useState(false)
  const [postedResult, setPostedResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let alive = true
    assistantApi.listExpenseCategories().then((res) => {
      if (!alive) return
      if (res.ok && Array.isArray(res.data)) {
        setCategories(res.data)
        if (fields.categoryName) {
          const pre = prefillFor('new_expense', { categoryName: fields.categoryName }, res.data)
          if (pre.categoryId) setCategoryId(pre.categoryId)
        }
      }
    })
    return () => { alive = false }
  }, [fields.categoryName])

  const handlePost = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount.')
      return
    }

    setBusy(true)
    setErrorMsg('')
    try {
      const draftRes = await assistantApi.createExpenseDraft(toExpenseDraftRequest({
        categoryId,
        amount: numAmount,
        date,
        note
      }))
      if (!draftRes.ok) {
        setErrorMsg(draftRes.message || 'Could not validate expense draft.')
        setBusy(false)
        return
      }

      const draft = draftRes.data
      const key = newIdempotencyKey()
      const confirmRes = await assistantApi.confirmDraft(draft.id, draft.payloadHash, key)
      if (confirmRes.ok) {
        setPostedResult({
          amount: numAmount,
          category: categories.find((c) => String(c.id) === String(categoryId))?.name || 'General Expense'
        })
        toast.success(`Expense of ${formatAED(numAmount)} recorded successfully!`)
      } else {
        setErrorMsg(confirmRes.message || 'Expense could not be confirmed.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record expense.')
    } finally {
      setBusy(false)
    }
  }

  const handleReadAloud = () => {
    const text = readBackText('new_expense', {
      categoryName: categories.find((c) => String(c.id) === String(categoryId))?.name || fields.categoryName,
      amount,
      date,
      note
    })
    speakUtterance(text, language)
  }

  if (postedResult) {
    return (
      <div className={`${surfaceCardClass} border-l-4 border-l-rose-600 space-y-2`}>
        <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
          <CheckCircle2 className="h-4 w-4 text-rose-600" />
          <span>Expense Recorded</span>
        </div>
        <p className="text-xs text-neutral-700">
          <strong>{formatAED(postedResult.amount)}</strong> recorded under <strong>{postedResult.category}</strong>.
        </p>
        <div className="pt-1 border-t border-neutral-100">
          <Link to="/expenses" className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline">
            Open in Expenses &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`${surfaceCardClass} border-l-4 border-l-rose-600 space-y-3`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900">
          <Receipt className="h-4 w-4 text-rose-600" />
          <span>Record Expense Action</span>
        </div>
        {ttsSupported(globalThis) && (
          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700"
            title="Read back details aloud"
          >
            <Volume2 className="h-3.5 w-3.5" /> Read
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block font-medium text-neutral-700 mb-0.5">Category *</label>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Amount (AED) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Date *</label>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-neutral-700 mb-0.5">Note</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Fuel for delivery van"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

      <div className="pt-1 border-t border-neutral-100">
        <button
          type="button"
          onClick={handlePost}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Recording Expense...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Confirm & Record Expense</span>
            </>
          )}
        </button>
      </div>
      <p className="text-[10px] text-neutral-500">
        Post happens through tenant-scoped accounting service only when you tap Confirm.
      </p>
    </div>
  )
}

function CustomerActionCard({ fields = {}, language = 'en' }) {
  const [form, setForm] = useState(() => ({
    name: fields.name || '',
    phone: fields.phone || '',
    email: fields.email || '',
    trn: fields.trn || '',
    address: fields.address || '',
    creditLimit: fields.creditLimit || '0',
    customerType: fields.customerType || 'Credit'
  }))

  const [busy, setBusy] = useState(false)
  const [createdResult, setCreatedResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handlePost = async () => {
    if (!form.name.trim()) {
      setErrorMsg('Customer name is required.')
      return
    }

    setBusy(true)
    setErrorMsg('')
    try {
      const draftRes = await assistantApi.createCustomerDraft(toDraftRequest(form))
      if (!draftRes.ok) {
        setErrorMsg(draftRes.message || 'Could not validate customer draft.')
        setBusy(false)
        return
      }

      const draft = draftRes.data
      const key = newIdempotencyKey()
      const confirmRes = await assistantApi.confirmDraft(draft.id, draft.payloadHash, key)
      if (confirmRes.ok) {
        const result = confirmRes.data?.result || {}
        setCreatedResult(result)
        toast.success(`Customer "${form.name}" created successfully!`)
      } else {
        setErrorMsg(confirmRes.message || 'Could not confirm customer creation.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create customer.')
    } finally {
      setBusy(false)
    }
  }

  const handleReadAloud = () => {
    const text = readBackText('new_customer', form)
    speakUtterance(text, language)
  }

  if (createdResult) {
    return (
      <div className={`${surfaceCardClass} border-l-4 border-l-teal-600 space-y-2`}>
        <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm">
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
          <span>Customer Created</span>
        </div>
        <p className="text-xs text-neutral-700">
          <strong>{form.name}</strong> has been added to your accounts.
        </p>
        <div className="pt-1 border-t border-neutral-100">
          <Link
            to={createdResult.customerId ? `/customers/${createdResult.customerId}` : '/customers'}
            className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline"
          >
            Open Customer Profile &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`${surfaceCardClass} border-l-4 border-l-teal-600 space-y-3`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-neutral-900">
          <UserPlus className="h-4 w-4 text-teal-600" />
          <span>New Customer Action</span>
        </div>
        {ttsSupported(globalThis) && (
          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700"
            title="Read back details aloud"
          >
            <Volume2 className="h-3.5 w-3.5" /> Read
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block font-medium text-neutral-700 mb-0.5">Customer Name *</label>
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Phone</label>
            <input
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">TRN (Tax #)</label>
            <input
              type="text"
              className={inputClass}
              value={form.trn}
              onChange={(e) => setForm({ ...form, trn: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Credit Limit (AED)</label>
            <input
              type="number"
              className={inputClass}
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-700 mb-0.5">Type</label>
            <select
              className={inputClass}
              value={form.customerType}
              onChange={(e) => setForm({ ...form, customerType: e.target.value })}
            >
              <option value="Credit">Credit</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>
      </div>

      {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

      <div className="pt-1 border-t border-neutral-100">
        <button
          type="button"
          onClick={handlePost}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Creating Customer...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Confirm & Create Customer</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ToolResultRows({ tool, rows, asOf }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-neutral-600">No records found matching your query.</p>
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        {rows.map((r, idx) => {
          if (ROUTE_TOOLS.has(tool)) {
            return (
              <li key={r.routeId ? `${r.routeId}-${r.customerId ?? idx}` : idx} className="p-3 text-sm hover:bg-neutral-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{r.name}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{routeRowDetail(tool, r)}</p>
                  </div>
                  {routeMapLink(r) && (
                    <Link
                      to={routeMapLink(r)}
                      className="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-800 underline"
                    >
                      Map pin &rarr;
                    </Link>
                  )}
                </div>
              </li>
            )
          }

          if (tool === 'search_company_documents') {
            return (
              <li key={r.id || idx} className="p-3 text-sm hover:bg-neutral-50">
                <p className="font-semibold text-neutral-900">
                  {r.title} <span className="text-xs font-normal text-neutral-500">· v{r.version} · {r.location}</span>
                </p>
                <p className="mt-1 text-xs text-neutral-700 italic break-words">"{r.snippet}"</p>
                <Link to="/documents" className="mt-1.5 inline-block text-xs text-primary-700 font-medium underline">
                  Open document &rarr;
                </Link>
              </li>
            )
          }

          if (tool === 'find_customers') {
            return (
              <li key={r.id || idx} className="p-3 text-sm hover:bg-neutral-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{r.name}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Phone: <span className="font-medium text-neutral-800">{r.phone || 'None'}</span>
                      {r.balance != null && (
                        <span className="ml-2 font-medium">
                          Balance: <span className={Number(r.balance) > 0 ? 'text-amber-700' : 'text-neutral-800'}>{formatAED(r.balance)}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    to={`/customers/${r.id}`}
                    className="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-800 underline"
                  >
                    Profile &rarr;
                  </Link>
                </div>
              </li>
            )
          }

          // Default / product_stock
          return (
            <li key={r.id || idx} className="p-3 text-sm hover:bg-neutral-50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {r.name} {r.sku && <span className="text-xs text-neutral-500 font-mono">({r.sku})</span>}
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Stock: <strong className={r.lowStock ? 'text-rose-600' : 'text-neutral-900'}>{r.stockQty} {r.unit || 'pcs'}</strong>
                    {r.lowStock && <span className="ml-1 text-[11px] font-semibold text-rose-600">(Low Stock)</span>}
                    {' · '}Sell: <strong className="text-neutral-900">{formatAED(r.sellPrice)}</strong>
                    {r.costPrice != null && <span className="text-neutral-500"> (Cost: {formatAED(r.costPrice)})</span>}
                  </p>
                </div>
                <Link
                  to={`/products/${r.id}`}
                  className="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-800 underline"
                >
                  View &rarr;
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-neutral-400">
        Records verified from PostgreSQL database{asOf ? ` as of ${new Date(asOf).toLocaleTimeString()}` : ''}.
      </p>
    </div>
  )
}

// ==========================================
// VOICE INPUT COMPONENT
// ==========================================

function VoiceMicButton({ onTranscript, language, onListeningChange }) {
  const [listening, setListening] = useState(false)
  const recognizer = useRef(null)
  const Ctor = recognitionCtor(globalThis)

  const stop = () => {
    try { recognizer.current?.stop() } catch {}
  }

  useEffect(() => () => {
    try { recognizer.current?.abort?.() } catch {}
  }, [])

  if (!Ctor) {
    return null
  }

  const start = () => {
    if (listening || recognizer.current) {
      stop()
      return
    }
    const rec = new Ctor()
    rec.lang = localeFor(language)
    rec.interimResults = false
    rec.continuous = false
    rec.maxAlternatives = 1
    let heard = ''

    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0]?.transcript || '').join(' ')
    }
    rec.onerror = (e) => {
      const err = describeVoiceError(e?.error)
      if (err) toast.error(err)
    }
    rec.onend = () => {
      recognizer.current = null
      setListening(false)
      onListeningChange && onListeningChange(false)
      if (heard.trim()) onTranscript(heard)
    }

    recognizer.current = rec
    try {
      rec.start()
      setListening(true)
      onListeningChange && onListeningChange(true)
    } catch {
      recognizer.current = null
      setListening(false)
      onListeningChange && onListeningChange(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={listening ? 'Stop listening' : 'Speak voice action'}
      title={listening ? 'Listening... Tap to finish' : 'Tap to speak'}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening
          ? 'bg-rose-600 text-white animate-pulse shadow-md ring-4 ring-rose-200'
          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
      }`}
    >
      <Mic className={`h-5 w-5 ${listening ? 'text-white' : 'text-neutral-700'}`} />
      {listening && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </span>
      )}
    </button>
  )
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function AssistantPanel({ open, onClose }) {
  const [expanded, setExpanded] = useState(false)
  const [language, setLanguage] = useState('en')
  const [chatAvailable, setChatAvailable] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [consentInfo, setConsentInfo] = useState(null)

  const streamEndRef = useRef(null)
  const closeRef = useRef(null)

  // Initial load
  useEffect(() => {
    if (!open) return
    let alive = true
    assistantApi.status().then((res) => {
      if (alive) setChatAvailable(!!res.data?.chat)
    })
    assistantApi.consent().then((res) => {
      if (alive && res.ok) setConsentInfo(res.data)
    })
    return () => { alive = false }
  }, [open])

  // Key listeners
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Scroll to bottom on new message
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  if (!open) return null

  const handleSendMessage = async (rawMessage) => {
    const text = (rawMessage || inputText).trim()
    if (!text || sending) return

    const problem = chatMessageProblem(text)
    if (problem) {
      toast.error(problem)
      return
    }

    const userMsgId = `user-${Date.now()}`
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMsg])
    if (!rawMessage) setInputText('')
    setSending(true)

    try {
      const res = await assistantApi.chat(text)
      if (!res.ok) {
        const errorView = {
          kind: 'refused',
          text: res.message || 'The assistant could not complete this request.'
        }
        setMessages((prev) => [
          ...prev,
          { id: `assist-${Date.now()}`, sender: 'assistant', view: errorView, timestamp: new Date() }
        ])
      } else {
        const view = describeChatReply(res.data)
        setMessages((prev) => [
          ...prev,
          { id: `assist-${Date.now()}`, sender: 'assistant', view, timestamp: new Date() }
        ])
      }
    } catch (err) {
      const errorView = {
        kind: 'unavailable',
        text: err.message || 'Connection lost. Please try again.'
      }
      setMessages((prev) => [
        ...prev,
        { id: `assist-${Date.now()}`, sender: 'assistant', view: errorView, timestamp: new Date() }
      ])
    } finally {
      setSending(false)
    }
  }

  const handleSaveConsent = async (enabled) => {
    const res = await assistantApi.setConsent(enabled, consentInfo?.policyFingerprint)
    if (res.ok) {
      setConsentInfo(res.data)
      assistantApi.status().then((r) => setChatAvailable(!!r.data?.chat))
      toast.success(enabled ? 'AI enabled for this company.' : 'AI disabled.')
    } else {
      toast.error(res.message || 'Could not update AI privacy settings.')
    }
  }

  return (
    <aside
      role="dialog"
      aria-label="HexaBill ERP Copilot"
      data-shell-hides-nav
      className={`fixed inset-0 z-[70] flex flex-col bg-neutral-100 shadow-2xl transition-all md:left-auto md:right-0 ${
        expanded ? 'md:w-full' : 'md:w-[28rem] lg:w-[32rem]'
      }`}
    >
      {/* 1. Header */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-900 leading-tight">HexaBill Copilot</h2>
            <p className="text-[11px] text-neutral-500">Action ERP AI Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language selector */}
          <select
            aria-label="Voice & Chat Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-8 rounded-md border border-neutral-300 bg-neutral-50 px-2 text-xs font-medium text-neutral-700 hover:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {VOICE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id.toUpperCase()} · {l.label.split(' ')[0]}
              </option>
            ))}
          </select>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="hidden h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-600 md:inline-flex"
            aria-label={expanded ? 'Minimize side panel' : 'Full screen'}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Close */}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-600"
            aria-label="Close assistant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 2. Quick Suggestion Chips */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2 scrollbar-none">
        <button
          type="button"
          onClick={() => handleSendMessage("Show today's business summary")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>📊</span> Summary
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Which customers are overdue on routes?")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>💸</span> Overdue
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Show low stock products")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>⚠️</span> Low Stock
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Record payment received")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>💰</span> Payment
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Create new sale invoice")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>🧾</span> Invoice
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Record expense")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>💸</span> Expense
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Add new customer")}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <span>🏢</span> Customer
        </button>
      </div>

      {/* 3. Action & Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 mb-3 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">Talk & Do ERP Copilot</h3>
            <p className="mt-1 text-xs text-neutral-600 max-w-sm">
              Speak or type actions in English, മലയാളം, हिन्दी, or العربية.
              Review calculated action cards with 1-tap confirmation.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 w-full max-w-xs text-left">
              <button
                type="button"
                onClick={() => handleSendMessage("Received 500 AED from Al Noor")}
                className="rounded-lg border border-neutral-200 bg-white p-2 text-xs hover:border-primary-500 hover:bg-neutral-50"
              >
                <p className="font-semibold text-neutral-900">💰 "Received 500 AED from Al Noor"</p>
                <p className="text-[11px] text-neutral-500">Prepares a payment receipt card</p>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Show today's business summary")}
                className="rounded-lg border border-neutral-200 bg-white p-2 text-xs hover:border-primary-500 hover:bg-neutral-50"
              >
                <p className="font-semibold text-neutral-900">📊 "Show today's business summary"</p>
                <p className="text-[11px] text-neutral-500">Live sales, collections, profit & receivables</p>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Record 80 AED fuel expense")}
                className="rounded-lg border border-neutral-200 bg-white p-2 text-xs hover:border-primary-500 hover:bg-neutral-50"
              >
                <p className="font-semibold text-neutral-900">💸 "Record 80 AED fuel expense"</p>
                <p className="text-[11px] text-neutral-500">Matches category and prepares expense</p>
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.sender === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-primary-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              )
            }

            const view = m.view
            return (
              <div key={m.id} className="flex justify-start">
                <div className="w-full max-w-[95%] space-y-2">
                  {view.heading && (
                    <p className="text-xs font-semibold text-neutral-700 px-1">
                      {view.heading}
                    </p>
                  )}

                  {/* Summary Card */}
                  {view.kind === 'dashboard_summary' && (
                    <SummaryActionCard
                      summary={view.summary}
                      asOf={view.asOf}
                      onAskPrompt={handleSendMessage}
                    />
                  )}

                  {/* Suggestion Action Cards */}
                  {view.kind === 'suggestion' && view.formKind === 'new_payment' && (
                    <PaymentActionCard fields={view.fields} language={language} />
                  )}

                  {view.kind === 'suggestion' && view.formKind === 'new_sale' && (
                    <InvoiceDraftActionCard fields={view.fields} language={language} />
                  )}

                  {view.kind === 'suggestion' && view.formKind === 'new_expense' && (
                    <ExpenseActionCard fields={view.fields} language={language} />
                  )}

                  {view.kind === 'suggestion' && view.formKind === 'new_customer' && (
                    <CustomerActionCard fields={view.fields} language={language} />
                  )}

                  {/* Tool Read Rows */}
                  {view.kind === 'tool' && (
                    <ToolResultRows tool={view.tool} rows={view.rows} asOf={view.asOf} />
                  )}

                  {/* Fallback text reply */}
                  {view.text && (
                    <div className="rounded-xl rounded-tl-none border border-neutral-200 bg-white p-3 text-xs text-neutral-800 shadow-sm leading-relaxed">
                      {view.text}
                    </div>
                  )}

                  {view.note && (
                    <p className="text-[10px] text-neutral-400 px-1">
                      {view.note}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-xl rounded-tl-none border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary-600 animate-spin" />
              <span>Thinking & checking books...</span>
            </div>
          </div>
        )}

        <div ref={streamEndRef} />
      </div>

      {/* 4. Manual Drawer / AI Privacy Collapsible */}
      <div className="border-t border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setShowDrawer((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3 w-3" />
            AI Policy & Direct Tool Access
          </span>
          {showDrawer ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        {showDrawer && (
          <div className="border-t border-neutral-100 bg-neutral-50 p-3 text-xs space-y-2 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800">Company AI Consent</span>
              {consentInfo?.canManage && (
                <button
                  type="button"
                  onClick={() => handleSaveConsent(!consentInfo?.enabled)}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold text-white ${
                    consentInfo?.enabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {consentInfo?.enabled ? 'Disable AI' : 'Enable AI'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 leading-normal">
              {consentInfo?.policyNotice || 'AI queries are tenant-isolated and strictly read-only for books. Human confirmation required for posting.'}
            </p>
          </div>
        )}
      </div>

      {/* 5. Bottom Input & Voice Action Bar */}
      <footer className="border-t border-neutral-200 bg-white p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2"
        >
          <VoiceMicButton
            language={language}
            onTranscript={(spokenText) => {
              setInputText((cur) => appendTranscript(cur, spokenText, CHAT_MAX_CHARS))
            }}
          />

          <input
            type="text"
            className="flex-1 min-h-10 rounded-full border border-neutral-300 bg-neutral-50 px-4 text-xs md:text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder={
              language === 'ml'
                ? "ചോദ്യമോ നിർദ്ദേശമോ പറയുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക..."
                : language === 'ar'
                ? "تحدث أو اكتب أمرك هنا..."
                : language === 'hi'
                ? "बोलें या लिखें (जैसे '500 AED payment received')..."
                : "Speak or type an action (e.g. 'Received 500 AED from Al Noor')..."
            }
            value={inputText}
            maxLength={CHAT_MAX_CHARS}
            onChange={(e) => setInputText(e.target.value)}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600"
            aria-label="Send action"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </footer>
    </aside>
  )
}
