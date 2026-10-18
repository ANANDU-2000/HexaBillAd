import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Maximize2, Minimize2, Search, UserPlus, Receipt, MessageSquare } from 'lucide-react'
import { assistantApi } from './assistantApi'
import { describeChatReply, CHAT_MAX_CHARS, chatMessageProblem } from './assistantChat'
import {
  canConfirm, describeConfirmFailure, emptyCustomerForm, emptyExpenseForm, fieldErrorMap, newIdempotencyKey, toDraftRequest, toExpenseDraftRequest,
} from './assistantDraft'

const inputClass = 'block w-full min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30'

function Field ({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

/** Customer or product rows read from the books (shared by the lookup and the chat). */
function ResultRows ({ tool, rows, asOf }) {
  return (
    <>
      <ul aria-label="Results" className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {rows.map((r) => (
          <li key={r.id} className="px-3 py-2 text-sm">
            {tool === 'search_company_documents' ? (
              <>
                <p className="font-medium text-neutral-900">{r.title} <span className="font-normal text-neutral-600">· version {r.version} · {r.location}</span></p>
                <p className="mt-1 text-xs text-neutral-700 break-words">“{r.snippet}”</p>
                <Link to="/documents" className="text-xs text-primary-700 underline">Open documents</Link>
              </>
            ) : (
              <p className="font-medium text-neutral-900">{r.name}{r.sku ? ` · ${r.sku}` : ''}</p>
            )}
            {tool === 'search_company_documents' ? null : tool === 'find_customers' ? (
              <p className="text-xs text-neutral-600">{r.phone || 'No phone'}{r.balance != null ? ` · Balance ${Number(r.balance).toFixed(2)}` : ''}</p>
            ) : (
              <p className="text-xs text-neutral-600">
                Stock {r.stockQty} {r.unit}{r.lowStock ? ' (low)' : ''} · Price {Number(r.sellPrice).toFixed(2)}{r.costPrice != null ? ` · Cost ${Number(r.costPrice).toFixed(2)}` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-500">Read from your records{asOf ? ` as of ${new Date(asOf).toLocaleTimeString()}` : ''}. Nothing was changed.</p>
    </>
  )
}

/** Ask in plain words. The assistant only chooses a lookup; the numbers shown always come from your records. */
function AskTab () {
  const [message, setMessage] = useState('')
  const [state, setState] = useState({ status: 'idle', view: null, error: '' })
  const sending = useRef(false)

  const ask = async (e) => {
    e.preventDefault()
    if (sending.current) return
    const problem = chatMessageProblem(message)
    if (problem) { setState({ status: 'error', view: null, error: problem }); return }
    sending.current = true
    setState({ status: 'loading', view: null, error: '' })
    const res = await assistantApi.chat(message.trim())
    sending.current = false
    if (!res.ok) { setState({ status: 'error', view: null, error: res.message || 'The assistant could not answer. Use the Look up tab.' }); return }
    setState({ status: 'done', view: describeChatReply(res.data), error: '' })
  }

  const view = state.view
  return (
    <form onSubmit={ask} className="space-y-3">
      <Field id="assistant-ask" label="Ask about a customer or a product">
        <textarea id="assistant-ask" rows={3} className={inputClass} value={message} maxLength={CHAT_MAX_CHARS} onChange={(e) => setMessage(e.target.value)} placeholder="For example: how much stock of rice do we have?" />
      </Field>
      <p className="text-xs text-neutral-600">The assistant only picks a lookup. It never changes anything, and the figures come from your records.</p>
      <button type="submit" disabled={state.status === 'loading'} className="btn btn-primary min-h-11 w-full">
        <MessageSquare className="h-4 w-4" aria-hidden /> {state.status === 'loading' ? 'Thinking…' : 'Ask'}
      </button>
      {state.status === 'error' && <p role="alert" className="text-sm text-error">{state.error}</p>}
      {state.status === 'done' && view && (
        <div className="space-y-2" data-testid="assistant-answer">
          {view.heading && <p className="text-sm font-medium text-neutral-900" data-testid="assistant-heading">{view.heading}</p>}
          {view.kind === 'tool' && view.rows.length === 0 && <p className="text-sm text-neutral-600">Nothing found.</p>}
          {view.kind === 'tool' && view.rows.length > 0 && <ResultRows tool={view.tool} rows={view.rows} asOf={view.asOf} />}
          {view.kind !== 'tool' && view.text && <p className="text-sm text-neutral-800" data-testid="assistant-text">{view.text}</p>}
          {view.note && <p className="text-xs text-neutral-500">{view.note}</p>}
        </div>
      )}
    </form>
  )
}

function FindTab () {
  const [tool, setTool] = useState('find_customers')
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ status: 'idle', rows: [], message: '' })

  const search = async (e) => {
    e.preventDefault()
    if (query.trim().length < 2) { setState({ status: 'error', rows: [], message: 'Type at least 2 characters.' }); return }
    setState({ status: 'loading', rows: [], message: '' })
    const res = await assistantApi.runTool(tool, { query: query.trim() })
    if (!res.ok) { setState({ status: 'error', rows: [], message: res.message || 'The search could not run. Use the normal screens.' }); return }
    setState({ status: 'done', rows: res.data?.data || [], message: '', asOf: res.data?.asOf })
  }

  return (
    <form onSubmit={search} className="space-y-3">
      <Field id="assistant-find-kind" label="Look up">
        <select id="assistant-find-kind" className={inputClass} value={tool} onChange={(e) => { setTool(e.target.value); setState({ status: 'idle', rows: [], message: '' }) }}>
          <option value="find_customers">Customers</option>
          <option value="product_stock">Products and stock</option>
          <option value="search_company_documents">Company documents</option>
        </select>
      </Field>
      <Field id="assistant-find-query" label={tool === 'search_company_documents' ? 'Words to look for' : 'Name, phone or SKU'}>
        <input id="assistant-find-query" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} />
      </Field>
      <button type="submit" disabled={state.status === 'loading'} className="btn btn-primary min-h-11 w-full">
        <Search className="h-4 w-4" aria-hidden /> {state.status === 'loading' ? 'Searching…' : 'Search'}
      </button>
      {state.status === 'error' && <p role="alert" className="text-sm text-error">{state.message}</p>}
      {state.status === 'done' && state.rows.length === 0 && <p className="text-sm text-neutral-600">Nothing found for “{query.trim()}”.</p>}
      {state.status === 'done' && state.rows.length > 0 && <ResultRows tool={tool} rows={state.rows} asOf={state.asOf} />}
    </form>
  )
}

function NewCustomerTab () {
  const [form, setForm] = useState(emptyCustomerForm())
  const [draft, setDraft] = useState(null) // the reviewed draft; any edit clears it so what is confirmed is what was shown
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const [created, setCreated] = useState(null)
  const keyRef = useRef(null)
  const draftRef = useRef(null)
  draftRef.current = draft

  // A reviewed draft that the person walks away from is cancelled, so it does not sit against the open-draft limit.
  const releaseDraft = (d) => { if (d && d.status === 'Draft' && d.id) assistantApi.cancelDraft(d.id) }
  useEffect(() => () => releaseDraft(draftRef.current), [])

  const set = (name) => (e) => { releaseDraft(draftRef.current); setForm((f) => ({ ...f, [name]: e.target.value })); setDraft(null); setFailure(null) }
  const errors = fieldErrorMap(draft?.errors)

  const review = async (e) => {
    e.preventDefault()
    releaseDraft(draftRef.current)
    setBusy(true); setFailure(null); setCreated(null)
    const res = await assistantApi.createCustomerDraft(toDraftRequest(form))
    setBusy(false)
    if (!res.ok) { setFailure({ text: res.message || 'The draft could not be prepared.' }); return }
    keyRef.current = newIdempotencyKey()
    setDraft(res.data)
  }

  const confirm = async () => {
    if (!canConfirm(draft) || busy) return
    setBusy(true); setFailure(null)
    const res = await assistantApi.confirmDraft(draft.id, draft.payloadHash, keyRef.current)
    setBusy(false)
    if (res.ok) { setCreated(res.data?.result || {}); setDraft(null); setForm(emptyCustomerForm()); return }
    setFailure(describeConfirmFailure(res.status, res.message))
    if (res.status === 409 || res.status === 410 || res.status === 404) setDraft(null)
  }

  const startOver = () => { releaseDraft(draftRef.current); setDraft(null); setFailure(null) }

  return (
    <div className="space-y-4">
      {created && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Customer created: <strong>{created.name}</strong>.{' '}
          {created.customerId ? <Link className="underline" to={`/customers/${created.customerId}`}>Open customer</Link> : null}
        </div>
      )}
      <form onSubmit={review} className="space-y-3" noValidate>
        <Field id="assistant-cust-name" label="Customer name *" error={errors.name}>
          <input id="assistant-cust-name" className={inputClass} value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field id="assistant-cust-phone" label="Phone" error={errors.phone}>
          <input id="assistant-cust-phone" className={inputClass} inputMode="tel" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field id="assistant-cust-email" label="Email" error={errors.email}>
          <input id="assistant-cust-email" className={inputClass} inputMode="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id="assistant-cust-trn" label="TRN" error={errors.trn}>
          <input id="assistant-cust-trn" className={inputClass} value={form.trn} onChange={set('trn')} />
        </Field>
        <Field id="assistant-cust-address" label="Address" error={errors.address}>
          <input id="assistant-cust-address" className={inputClass} value={form.address} onChange={set('address')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="assistant-cust-credit" label="Credit limit" error={errors.creditLimit}>
            <input id="assistant-cust-credit" className={inputClass} inputMode="decimal" value={form.creditLimit} onChange={set('creditLimit')} aria-invalid={Boolean(errors.creditLimit)} />
          </Field>
          <Field id="assistant-cust-type" label="Type">
            <select id="assistant-cust-type" className={inputClass} value={form.customerType} onChange={set('customerType')}>
              <option value="Credit">Credit</option>
              <option value="Cash">Cash</option>
            </select>
          </Field>
        </div>
        <button type="submit" disabled={busy} className="btn btn-secondary min-h-11 w-full">
          <UserPlus className="h-4 w-4" aria-hidden /> {busy && !draft ? 'Checking…' : 'Review'}
        </button>
      </form>

      {draft && (
        <section aria-label="Review before creating" className="space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-3">
          <h3 className="text-sm font-semibold text-neutral-900">Review before creating</h3>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-neutral-500">Name</dt><dd className="break-words">{draft.fields.name || '—'}</dd>
            <dt className="text-neutral-500">Phone</dt><dd>{draft.fields.phone || '—'}</dd>
            <dt className="text-neutral-500">Email</dt><dd className="break-words">{draft.fields.email || '—'}</dd>
            <dt className="text-neutral-500">TRN</dt><dd>{draft.fields.trn || '—'}</dd>
            <dt className="text-neutral-500">Address</dt><dd className="break-words">{draft.fields.address || '—'}</dd>
            <dt className="text-neutral-500">Credit limit</dt><dd>{Number(draft.fields.creditLimit).toFixed(2)}</dd>
            <dt className="text-neutral-500">Type</dt><dd>{draft.fields.customerType}</dd>
          </dl>
          {draft.warnings?.map((w) => <p key={w} className="text-xs text-amber-800">{w}</p>)}
          {draft.errors?.length > 0
            ? <p role="alert" className="text-sm text-error">Fix the highlighted fields, then review again.</p>
            : <p className="text-xs text-neutral-600">Nothing is saved until you confirm. This draft expires in 15 minutes.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirm} disabled={!canConfirm(draft) || busy} className="btn btn-primary min-h-11 flex-1">
              {busy ? 'Creating…' : 'Confirm and create'}
            </button>
            <button type="button" onClick={startOver} disabled={busy} className="btn btn-secondary min-h-11">Edit</button>
          </div>
        </section>
      )}

      {failure && (
        <div role="alert" className="rounded-md border border-error-border bg-error-bg p-3 text-sm text-error-fg">
          <p>{failure.text}</p>
          {failure.uncertain && <Link to="/customers" className="mt-1 inline-block underline">Open Customers</Link>}
        </div>
      )}
    </div>
  )
}


function NewExpenseTab () {
  const [form, setForm] = useState(emptyExpenseForm())
  const [categories, setCategories] = useState([])
  const [categoriesState, setCategoriesState] = useState('loading')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const [created, setCreated] = useState(null)
  const keyRef = useRef(null)
  const draftRef = useRef(null)
  draftRef.current = draft

  const releaseDraft = (d) => { if (d && d.status === 'Draft' && d.id) assistantApi.cancelDraft(d.id) }
  useEffect(() => () => releaseDraft(draftRef.current), [])

  useEffect(() => {
    let cancelled = false
    assistantApi.listExpenseCategories().then((res) => {
      if (cancelled) return
      if (res.ok && Array.isArray(res.data)) { setCategories(res.data); setCategoriesState('ready') } else setCategoriesState('error')
    })
    return () => { cancelled = true }
  }, [])

  const set = (name) => (e) => { releaseDraft(draftRef.current); setForm((f) => ({ ...f, [name]: e.target.value })); setDraft(null); setFailure(null) }
  const errors = fieldErrorMap(draft?.errors)

  const review = async (e) => {
    e.preventDefault()
    releaseDraft(draftRef.current)
    setBusy(true); setFailure(null); setCreated(null)
    const res = await assistantApi.createExpenseDraft(toExpenseDraftRequest(form))
    setBusy(false)
    if (!res.ok) { setFailure({ text: res.message || 'The draft could not be prepared.' }); return }
    keyRef.current = newIdempotencyKey()
    setDraft(res.data)
  }

  const confirm = async () => {
    if (!canConfirm(draft) || busy) return
    setBusy(true); setFailure(null)
    const res = await assistantApi.confirmDraft(draft.id, draft.payloadHash, keyRef.current)
    setBusy(false)
    if (res.ok) { setCreated(res.data?.result || {}); setDraft(null); setForm(emptyExpenseForm()); return }
    setFailure(describeConfirmFailure(res.status, res.message, 'Expenses', 'expense'))
    if (res.status === 409 || res.status === 410 || res.status === 404) setDraft(null)
  }

  const startOver = () => { releaseDraft(draftRef.current); setDraft(null); setFailure(null) }

  return (
    <div className="space-y-4">
      {created && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Expense recorded: <strong>{Number(created.amount).toFixed(2)}</strong>{created.status === 'Pending' ? ' (waiting for approval)' : ''}.{' '}
          <Link className="underline" to="/expenses">Open Expenses</Link>
        </div>
      )}
      {categoriesState === 'error' && <p role="alert" className="text-sm text-error">Expense categories could not be loaded. Use the Expenses screen.</p>}
      <form onSubmit={review} className="space-y-3" noValidate>
        <Field id="assistant-exp-category" label="Category *" error={errors.categoryId}>
          <select id="assistant-exp-category" className={inputClass} value={form.categoryId} onChange={set('categoryId')} aria-invalid={Boolean(errors.categoryId)}>
            <option value="">Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="assistant-exp-amount" label="Amount *" error={errors.amount}>
            <input id="assistant-exp-amount" className={inputClass} inputMode="decimal" value={form.amount} onChange={set('amount')} aria-invalid={Boolean(errors.amount)} />
          </Field>
          <Field id="assistant-exp-date" label="Date *" error={errors.date}>
            <input id="assistant-exp-date" type="date" className={inputClass} value={form.date} onChange={set('date')} aria-invalid={Boolean(errors.date)} />
          </Field>
        </div>
        <Field id="assistant-exp-note" label="Note" error={errors.note}>
          <input id="assistant-exp-note" className={inputClass} value={form.note} onChange={set('note')} />
        </Field>
        <button type="submit" disabled={busy || categoriesState === 'loading'} className="btn btn-secondary min-h-11 w-full">
          <Receipt className="h-4 w-4" aria-hidden /> {busy && !draft ? 'Checking…' : 'Review'}
        </button>
      </form>

      {draft && (
        <section aria-label="Review before recording" className="space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-3">
          <h3 className="text-sm font-semibold text-neutral-900">Review before recording</h3>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-neutral-500">Category</dt><dd className="break-words">{draft.fields.categoryName || '—'}</dd>
            <dt className="text-neutral-500">Amount</dt><dd>{Number(draft.fields.amount).toFixed(2)}</dd>
            <dt className="text-neutral-500">Date</dt><dd>{draft.fields.date || '—'}</dd>
            <dt className="text-neutral-500">Note</dt><dd className="break-words">{draft.fields.note || '—'}</dd>
          </dl>
          {draft.warnings?.map((w) => <p key={w} className="text-xs text-amber-800">{w}</p>)}
          {draft.errors?.length > 0
            ? <p role="alert" className="text-sm text-error">Fix the highlighted fields, then review again.</p>
            : <p className="text-xs text-neutral-600">Nothing is saved until you confirm. This draft expires in 15 minutes.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirm} disabled={!canConfirm(draft) || busy} className="btn btn-primary min-h-11 flex-1">
              {busy ? 'Recording…' : 'Confirm and record'}
            </button>
            <button type="button" onClick={startOver} disabled={busy} className="btn btn-secondary min-h-11">Edit</button>
          </div>
        </section>
      )}

      {failure && (
        <div role="alert" className="rounded-md border border-error-border bg-error-bg p-3 text-sm text-error-fg">
          <p>{failure.text}</p>
          {failure.uncertain && <Link to="/expenses" className="mt-1 inline-block underline">Open Expenses</Link>}
        </div>
      )}
    </div>
  )
}

/**
 * Right-side assistant panel (full-screen on phones, optionally full-screen on larger screens).
 * No model is involved: it runs read-only lookups and a draft, review, confirm flow, all enforced by the server.
 */
export default function AssistantPanel ({ open, onClose }) {
  const [tab, setTab] = useState('find')
  const [chatOn, setChatOn] = useState(false)
  useEffect(() => {
    let alive = true
    assistantApi.status().then((res) => { if (alive) setChatOn(!!res.data?.chat) })
    return () => { alive = false }
  }, [])
  const [expanded, setExpanded] = useState(false)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const tabClass = (id) => `min-h-11 flex-1 border-b-2 px-3 text-sm font-medium ${tab === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-600'}`
  return (
    <aside
      role="dialog"
      aria-label="Assistant"
      data-shell-hides-nav
      className={`fixed inset-0 z-[70] flex flex-col bg-white shadow-2xl md:left-auto md:right-0 ${expanded ? 'md:w-full' : 'md:w-[26rem]'}`}
    >
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <h2 className="text-base font-semibold text-neutral-900">Assistant</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="hidden min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-neutral-100 md:inline-flex" aria-label={expanded ? 'Use side panel' : 'Full screen'}>
            {expanded ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <button ref={closeRef} type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-neutral-100" aria-label="Close assistant">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>
      <div role="tablist" className="flex border-b border-neutral-200">
        <button role="tab" aria-selected={tab === 'find'} type="button" className={tabClass('find')} onClick={() => setTab('find')}>Look up</button>
        {chatOn && <button role="tab" aria-selected={tab === 'ask'} type="button" className={tabClass('ask')} onClick={() => setTab('ask')}>Ask</button>}
        <button role="tab" aria-selected={tab === 'customer'} type="button" className={tabClass('customer')} onClick={() => setTab('customer')}>New customer</button>
        <button role="tab" aria-selected={tab === 'expense'} type="button" className={tabClass('expense')} onClick={() => setTab('expense')}>New expense</button>
      </div>
      <div className={`flex-1 overflow-y-auto p-4 ${expanded ? 'md:mx-auto md:w-full md:max-w-2xl' : ''}`}>
        <p className="mb-3 text-xs text-neutral-500">Lookups only read your records. Anything that creates data is shown to you first and needs your confirmation.</p>
        {tab === 'find' ? <FindTab /> : tab === 'ask' && chatOn ? <AskTab /> : tab === 'customer' ? <NewCustomerTab /> : <NewExpenseTab />}
      </div>
    </aside>
  )
}
