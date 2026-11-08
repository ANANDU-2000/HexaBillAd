import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Receipt, Wallet, CreditCard } from '../../components/ui/icons'
import { customersAPI } from '../../services'
import ActionCard from './ActionCard'
import { assistantApi } from './assistantApi'
import { prefillFor } from './assistantChat'
import { canConfirm, describeConfirmFailure, fieldErrorMap, newIdempotencyKey, toDraftRequest, toExpenseDraftRequest } from './assistantDraft'
import { readBackText, localeFor, ttsSupported } from './voice'

export function formatAED (val) {
  const n = parseFloat(val)
  if (!Number.isFinite(n)) return '0.00 AED'
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
}

function speak (text, langId = 'en') {
  if (!ttsSupported(globalThis) || !text) return
  try {
    globalThis.speechSynthesis.cancel()
    const utterance = new globalThis.SpeechSynthesisUtterance(text)
    utterance.lang = localeFor(langId)
    globalThis.speechSynthesis.speak(utterance)
  } catch { /* speech is a convenience only */ }
}

function Dismissed ({ what }) {
  return <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-700">Cancelled. Nothing was saved{what ? ` for ${what}` : ''}.</p>
}

/** Draft problems -> one readable line. The server's own messages are used as they are. */
function draftProblems (draft) {
  const map = fieldErrorMap(draft?.errors)
  const lines = Object.values(map)
  if (lines.length) return lines.slice(0, 3).join(' ')
  return 'The draft could not be checked. Review the details and try again.'
}

// ---- Customer: draft -> confirm ----------------------------------------------------------------------------------------------
export function CustomerActionCard ({ fields = {}, language = 'en' }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({
    name: fields.name || '', phone: fields.phone || '', email: fields.email || '', trn: fields.trn || '', address: fields.address || '',
    creditLimit: fields.creditLimit || '', customerType: fields.customerType || 'Credit',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [cancelled, setCancelled] = useState(false)
  const keyRef = useRef(null)

  if (cancelled) return <Dismissed what="this customer" />

  const confirm = async () => {
    if (!form.name.trim()) { setError('Customer name is required.'); return }
    setBusy(true); setError('')
    try {
      const draftRes = await assistantApi.createCustomerDraft(toDraftRequest(form))
      if (!draftRes.ok) { setError(draftRes.message || 'Could not check this customer.'); return }
      if (!canConfirm(draftRes.data)) { setError(draftProblems(draftRes.data)); return }
      keyRef.current = keyRef.current || newIdempotencyKey()
      const res = await assistantApi.confirmDraft(draftRes.data.id, draftRes.data.payloadHash, keyRef.current)
      if (res.ok) {
        setCreated(res.data?.result || {})
        toast.success(`Customer "${form.name}" created.`)
      } else {
        setError(describeConfirmFailure(res.status, res.message).text)
        if (res.status && res.status < 500) keyRef.current = null
      }
    } catch (err) {
      setError(err?.message || 'Failed to create customer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionCard
      testId="action-customer"
      title="Add customer"
      icon={UserPlus}
      values={form}
      onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
      fields={[
        { key: 'name', label: 'Customer name', required: true, wide: true },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'trn', label: 'TRN (tax number)' },
        { key: 'creditLimit', label: 'Credit limit (AED)', type: 'number', min: '0' },
        { key: 'customerType', label: 'Type', type: 'select', options: [{ value: 'Credit', label: 'Credit' }, { value: 'Cash', label: 'Cash' }] },
      ]}
      confirmLabel="Confirm and add"
      busyLabel="Adding..."
      busy={busy}
      error={error}
      onConfirm={confirm}
      onEditFull={() => navigate('/customers', { state: { assistantPrefill: { kind: 'new_customer', values: form } } })}
      onCancel={() => setCancelled(true)}
      onReadAloud={() => speak(readBackText('new_customer', form), language)}
      success={created ? {
        title: 'Customer added',
        message: `${form.name} is now in your customers.`,
        href: created.customerId ? `/customers/${created.customerId}` : '/customers',
        linkLabel: 'Open customer',
      } : null}
    />
  )
}

// ---- Expense: draft -> confirm -----------------------------------------------------------------------------------------------
export function ExpenseActionCard ({ fields = {}, language = 'en' }) {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(() => ({
    categoryId: '', amount: fields.amount || '', date: fields.date || new Date().toISOString().slice(0, 10), note: fields.note || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [cancelled, setCancelled] = useState(false)
  const keyRef = useRef(null)

  useEffect(() => {
    let alive = true
    assistantApi.listExpenseCategories().then((res) => {
      if (!alive || !res.ok || !Array.isArray(res.data)) return
      setCategories(res.data)
      if (fields.categoryName) {
        const pre = prefillFor('new_expense', { categoryName: fields.categoryName }, res.data)
        if (pre.categoryId) setForm((f) => (f.categoryId ? f : { ...f, categoryId: pre.categoryId }))
      }
    })
    return () => { alive = false }
  }, [fields.categoryName])

  if (cancelled) return <Dismissed what="this expense" />

  const categoryName = categories.find((c) => String(c.id) === String(form.categoryId))?.name || ''

  const confirm = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { setError('Enter an amount greater than 0.'); return }
    if (!form.categoryId) { setError('Choose a category.'); return }
    setBusy(true); setError('')
    try {
      const draftRes = await assistantApi.createExpenseDraft(toExpenseDraftRequest({ ...form, amount }))
      if (!draftRes.ok) { setError(draftRes.message || 'Could not check this expense.'); return }
      if (!canConfirm(draftRes.data)) { setError(draftProblems(draftRes.data)); return }
      keyRef.current = keyRef.current || newIdempotencyKey()
      const res = await assistantApi.confirmDraft(draftRes.data.id, draftRes.data.payloadHash, keyRef.current)
      if (res.ok) {
        setDone({ amount, category: categoryName || 'General expense' })
        toast.success(`Expense of ${formatAED(amount)} recorded.`)
      } else {
        setError(describeConfirmFailure(res.status, res.message, 'Expenses', 'expense').text)
        if (res.status && res.status < 500) keyRef.current = null
      }
    } catch (err) {
      setError(err?.message || 'Failed to record the expense.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionCard
      testId="action-expense"
      title="Record expense"
      icon={Receipt}
      values={form}
      onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
      fields={[
        { key: 'categoryId', label: 'Category', required: true, wide: true, type: 'select', options: [{ value: '', label: 'Select category' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))] },
        { key: 'amount', label: 'Amount (AED)', required: true, type: 'number', step: '0.01', min: '0.01' },
        { key: 'date', label: 'Date', required: true, type: 'date' },
        { key: 'note', label: 'Note', wide: true, placeholder: 'e.g. Fuel for delivery van' },
      ]}
      confirmLabel="Confirm and record"
      busyLabel="Recording..."
      busy={busy}
      error={error}
      onConfirm={confirm}
      onEditFull={() => navigate('/expenses', { state: { assistantPrefill: { kind: 'new_expense', values: form } } })}
      onCancel={() => setCancelled(true)}
      onReadAloud={() => speak(readBackText('new_expense', { categoryName: categoryName || fields.categoryName, amount: form.amount, date: form.date, note: form.note }), language)}
      success={done ? {
        title: 'Expense recorded',
        message: `${formatAED(done.amount)} under ${done.category}.`,
        href: '/expenses',
        linkLabel: 'Open expenses',
      } : null}
    />
  )
}

// ---- Payment: hands off to Payments (the UI never posts money itself) -------------------------------------------------------
export function PaymentActionCard ({ fields = {}, language = 'en' }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ customerName: fields.customerName || '', amount: fields.amount || '', mode: (fields.mode || 'CASH').toUpperCase(), reference: fields.reference || '' }))
  const [match, setMatch] = useState(null)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    const name = form.customerName.trim()
    if (name.length < 2) return undefined
    let active = true
    const t = setTimeout(() => {
      customersAPI.searchCustomers(name, 5).then((res) => {
        if (!active) return
        const list = res?.data || []
        setMatch(list.find((c) => String(c.name).toLowerCase() === name.toLowerCase()) || list[0] || null)
      }).catch(() => { if (active) setMatch(null) })
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [form.customerName])

  if (cancelled) return <Dismissed what="this payment" />

  const openPayments = () => {
    const qs = match?.id ? `?customerId=${encodeURIComponent(match.id)}` : ''
    navigate(`/payments${qs}`, { state: { assistantPrefill: { kind: 'new_payment', values: { ...form, customerId: match?.id ?? null } } } })
  }

  return (
    <ActionCard
      testId="action-payment"
      title="Record payment"
      icon={Wallet}
      values={form}
      onChange={(key, value) => { setForm((f) => ({ ...f, [key]: value })); if (key === 'customerName') setMatch(null) }}
      fields={[
        { key: 'customerName', label: 'Customer', required: true, wide: true, placeholder: 'e.g. Al Noor Supermarket', hint: match ? `Matched: ${match.name} · balance ${formatAED(match.balance || 0)}` : '' },
        { key: 'amount', label: 'Amount (AED)', type: 'number', step: '0.01', min: '0.01' },
        { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'CASH', label: 'Cash' }, { value: 'ONLINE', label: 'Online / bank' }, { value: 'CHEQUE', label: 'Cheque' }] },
      ]}
      warning="Nothing is saved here. Payments opens with this customer so you can check and post it."
      confirmLabel="Review in Payments"
      onConfirm={openPayments}
      onCancel={() => setCancelled(true)}
      onReadAloud={() => speak(readBackText('new_payment', { ...form, customerName: match?.name || form.customerName }), language)}
    />
  )
}

// ---- Invoice: hands off to POS ----------------------------------------------------------------------------------------------
export function InvoiceDraftActionCard ({ fields = {}, language = 'en' }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ customerName: fields.customerName || '', items: fields.items || '', amount: fields.amount || '', paymentMethod: fields.paymentMethod || 'Cash' }))
  const [cancelled, setCancelled] = useState(false)
  if (cancelled) return <Dismissed what="this invoice" />

  const openPos = () => {
    const params = new URLSearchParams()
    if (form.customerName) params.set('customer', form.customerName)
    if (form.items) params.set('draftItems', form.items)
    const qs = params.toString()
    navigate(`/pos${qs ? `?${qs}` : ''}`, { state: { assistantPrefill: { kind: 'new_sale', values: form } } })
  }

  return (
    <ActionCard
      testId="action-invoice"
      title="New invoice"
      icon={CreditCard}
      values={form}
      onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
      fields={[
        { key: 'customerName', label: 'Customer', wide: true },
        { key: 'items', label: 'Items', wide: true, placeholder: 'e.g. 10 x Basmati rice 5kg' },
        { key: 'amount', label: 'Estimated total (AED)', type: 'number', step: '0.01', min: '0' },
        { key: 'paymentMethod', label: 'Payment', type: 'select', options: [{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }, { value: 'Card', label: 'Card' }] },
      ]}
      warning="Nothing is saved here. POS opens so you can scan items, check the total and finish the bill."
      confirmLabel="Open in POS"
      onConfirm={openPos}
      onCancel={() => setCancelled(true)}
      onReadAloud={() => speak(readBackText('new_sale', form), language)}
    />
  )
}

/** Picks the card for an assistant suggestion (view.formKind). */
export function SuggestionCard ({ formKind, fields, language }) {
  if (formKind === 'new_customer') return <CustomerActionCard fields={fields} language={language} />
  if (formKind === 'new_expense') return <ExpenseActionCard fields={fields} language={language} />
  if (formKind === 'new_payment') return <PaymentActionCard fields={fields} language={language} />
  if (formKind === 'new_sale') return <InvoiceDraftActionCard fields={fields} language={language} />
  return null
}
