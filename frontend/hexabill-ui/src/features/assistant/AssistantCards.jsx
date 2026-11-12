import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus, Trash2, Search, ShoppingCart, Package, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { customersAPI, productsAPI, salesAPI, paymentsAPI } from '../../services'
import { newIdempotencyKey } from './assistantDraft'

const field = 'block w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-slate-500 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30'
const card = 'rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm text-neutral-900'
const label = 'mb-1 block text-xs font-medium text-neutral-600'

const money = (n) => `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
const listOf = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.items) ? res.data.items : [])
const errText = (err, fallback) => err?.response?.data?.message || err?.message || fallback

/** Small debounced search box that shows a pick list. */
function Picker ({ placeholder, search, onPick, render, disabled }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (q.trim().length < 1) { setRows([]); return undefined }
    const id = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const found = await search(q.trim())
        if (id === seq.current) setRows(found.slice(0, 6))
      } catch { if (id === seq.current) setRows([]) } finally { if (id === seq.current) setBusy(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className={`${field} pl-9`} placeholder={placeholder} value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} />
        {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}
      </div>
      {rows.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-primary-50"
                onClick={() => { onPick(r); setQ(''); setRows([]) }}>
                {render(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function InvoiceCreateCard ({ fields = {} }) {
  const [customer, setCustomer] = useState(null)
  const [walkIn, setWalkIn] = useState(false)
  const [lines, setLines] = useState([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [paid, setPaid] = useState(null)
  const keyRef = useRef(newIdempotencyKey())

  // Pre-select the customer the person named, when exactly one matches.
  useEffect(() => {
    const name = (fields.customerName || '').trim()
    if (name.length < 2) return undefined
    let alive = true
    customersAPI.searchCustomers(name, 5).then((res) => {
      const list = listOf(res)
      const exact = list.find((c) => c.name?.toLowerCase() === name.toLowerCase())
      if (alive && (exact || list.length === 1)) setCustomer(exact || list[0])
    }).catch(() => {})
    return () => { alive = false }
  }, [fields.customerName])

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0), [lines])

  const addProduct = (p) => setLines((cur) => cur.some((l) => l.productId === p.id)
    ? cur.map((l) => (l.productId === p.id ? { ...l, qty: Number(l.qty) + 1 } : l))
    : [...cur, { productId: p.id, name: p.nameEn || p.name, unit: p.unitType || 'PCS', qty: 1, price: p.sellPrice ?? 0, stock: p.stockQty }])
  const setLine = (i, patch) => setLines((cur) => cur.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  const canSave = lines.length > 0 && (customer || walkIn) && lines.every((l) => Number(l.qty) > 0 && Number(l.price) >= 0)

  const save = async () => {
    if (!canSave || busy) return
    setBusy(true); setError('')
    try {
      const res = await salesAPI.createSale({
        customerId: customer?.id ?? null,
        items: lines.map((l) => ({ productId: l.productId, unitType: l.unit, qty: Number(l.qty), unitPrice: Number(l.price) })),
        notes: notes.trim() || undefined,
        externalReference: `assistant:${keyRef.current}`,
      })
      if (res?.success === false || !res?.data) { setError(res?.message || 'The invoice could not be saved. Nothing was posted.'); return }
      setResult(res.data)
      toast.success(`Invoice ${res.data.invoiceNo} created`)
    } catch (err) {
      setError(errText(err, 'The invoice could not be saved. Check Sales before trying again, so it is not created twice.'))
    } finally { setBusy(false) }
  }

  const receive = async () => {
    if (!result || !customer || busy) return
    setBusy(true); setError('')
    try {
      const res = await paymentsAPI.createPayment({ customerId: customer.id, saleId: result.id, amount: Number(result.grandTotal), mode: 'CASH', paymentDate: new Date() }, newIdempotencyKey())
      if (res?.success === false) { setError(res?.message || 'The payment could not be saved.'); return }
      setPaid(true); toast.success('Payment recorded')
    } catch (err) { setError(errText(err, 'The payment could not be saved.')) } finally { setBusy(false) }
  }

  if (result) {
    return (
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" />Invoice {result.invoiceNo} created</div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-neutral-500">Subtotal</dt><dd className="font-semibold tabular-nums">{money(result.subtotal)}</dd></div>
          <div><dt className="text-xs text-neutral-500">VAT</dt><dd className="font-semibold tabular-nums">{money(result.vatTotal)}</dd></div>
          <div><dt className="text-xs text-neutral-500">Total</dt><dd className="font-bold tabular-nums">{money(result.grandTotal)}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link to="/sales-ledger" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50">Open Sales</Link>
          {customer && !paid && <button type="button" onClick={receive} disabled={busy} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : `Received ${money(result.grandTotal)} cash`}</button>}
          {paid && <span className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-700">Paid in full</span>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-neutral-500">Left unpaid, it stays on the customer's account.</p>
      </div>
    )
  }

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-5 w-5 text-slate-700" />New invoice</div>

      <div>
        <span className={label}>Customer</span>
        {customer ? (
          <div className="flex min-h-11 items-center justify-between rounded-lg bg-slate-50 px-3 text-sm">
            <span className="font-medium">{customer.name}</span>
            <button type="button" className="text-xs text-slate-700 underline" onClick={() => setCustomer(null)}>Change</button>
          </div>
        ) : (
          <>
            <Picker placeholder="Search customer by name or phone" search={async (q) => listOf(await customersAPI.searchCustomers(q, 6))} onPick={(c) => { setCustomer(c); setWalkIn(false) }}
              render={(c) => (<><span className="font-medium">{c.name}</span><span className="text-xs text-neutral-500">{c.phone || ''}</span></>)} />
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={walkIn} onChange={(e) => setWalkIn(e.target.checked)} className="h-4 w-4" /> Walk-in (no customer)
            </label>
          </>
        )}
      </div>

      <div>
        <span className={label}>Add items</span>
        <Picker placeholder="Search product by name, SKU or barcode" search={async (q) => listOf(await productsAPI.searchProducts(q, 8))} onPick={addProduct}
          render={(p) => (<><span className="font-medium">{p.nameEn}</span><span className="text-xs text-neutral-500">{money(p.sellPrice)} · stock {p.stockQty}</span></>)} />
      </div>

      {lines.length > 0 && (
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={l.productId} className="rounded-lg border border-neutral-200 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{l.name}</span>
                <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setLines((c) => c.filter((_, k) => k !== i))} className="p-1 text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-neutral-500">Qty ({l.unit})<input inputMode="decimal" className={field} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></label>
                <label className="text-xs text-neutral-500">Price<input inputMode="decimal" className={field} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} /></label>
                <div className="text-xs text-neutral-500">Line<div className="flex min-h-11 items-center text-sm font-semibold tabular-nums text-neutral-900">{money((Number(l.qty) || 0) * (Number(l.price) || 0))}</div></div>
              </div>
              {Number(l.qty) > Number(l.stock) && <p className="mt-1 text-xs text-warning-fg">Only {l.stock} in stock.</p>}
            </li>
          ))}
        </ul>
      )}

      <label className="block"><span className={label}>Note (optional)</span><input className={field} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} /></label>

      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
        <span className="text-neutral-600">Subtotal (VAT is added when saved)</span><span className="font-bold tabular-nums">{money(subtotal)}</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={!canSave || busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
        <Plus className="h-4 w-4" />{busy ? 'Saving…' : 'Confirm and create invoice'}
      </button>
      <p className="text-xs text-neutral-500">Nothing is saved until you tap Confirm. Prices and stock come from your products.</p>
    </div>
  )
}

const UNITS = ['PCS', 'KG', 'CRTN', 'BOX', 'BAG', 'LTR']

export function ProductCreateCard ({ fields = {} }) {
  const [name, setName] = useState(fields.name || '')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('PCS')
  const [cost, setCost] = useState('')
  const [sell, setSell] = useState('')
  const [stock, setStock] = useState('')
  const [reorder, setReorder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const autoSku = () => `${(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'ITEM').toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const valid = name.trim().length >= 2 && Number(sell) >= 0 && sell !== '' && (cost === '' || Number(cost) >= 0)

  const save = async () => {
    if (!valid || busy) return
    setBusy(true); setError('')
    try {
      const res = await productsAPI.createProduct({
        sku: (sku.trim() || autoSku()).slice(0, 50), nameEn: name.trim().slice(0, 200), unitType: unit, conversionToBase: 1,
        costPrice: Number(cost || 0), sellPrice: Number(sell), stockQty: Number(stock || 0), reorderLevel: Math.round(Number(reorder || 0)),
      })
      if (res?.success === false || !res?.data) { setError(res?.message || 'The product could not be saved.'); return }
      setDone(res.data); toast.success('Product added')
    } catch (err) { setError(errText(err, 'The product could not be saved. Check Products before trying again.')) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className={`${card} space-y-2`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" />Product added</div>
        <p className="text-sm">{done.nameEn} · {done.sku} · {money(done.sellPrice)}</p>
        <Link to="/products" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50">Open Products</Link>
      </div>
    )
  }
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><Package className="h-5 w-5 text-warning-fg" />New product</div>
      <label className="block"><span className={label}>Name</span><input className={field} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={label}>Unit</span>
          <select className={field} value={unit} onChange={(e) => setUnit(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="block"><span className={label}>SKU (auto if empty)</span><input className={field} value={sku} maxLength={50} onChange={(e) => setSku(e.target.value)} /></label>
        <label className="block"><span className={label}>Cost price</span><input inputMode="decimal" className={field} value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        <label className="block"><span className={label}>Selling price</span><input inputMode="decimal" className={field} value={sell} onChange={(e) => setSell(e.target.value)} /></label>
        <label className="block"><span className={label}>Opening stock</span><input inputMode="decimal" className={field} value={stock} onChange={(e) => setStock(e.target.value)} /></label>
        <label className="block"><span className={label}>Reorder level</span><input inputMode="numeric" className={field} value={reorder} onChange={(e) => setReorder(e.target.value)} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={!valid || busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-warning-fg px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Confirm and add product'}</button>
    </div>
  )
}
