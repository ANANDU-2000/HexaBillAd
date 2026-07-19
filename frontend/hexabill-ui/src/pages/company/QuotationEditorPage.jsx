import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, Download, Printer } from 'lucide-react'
import { quotationsAPI } from '../../services/documentsApi'
import { calcQuoteLine, calcQuoteTotals } from '../../utils/quoteMath'

const emptyLine = () => ({
  description: '',
  unitLabel: 'Pcs',
  qty: 1,
  unitPrice: 0,
  vatRate: 5,
})

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 1000)
}

function openPdfBlob(blob) {
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

export default function QuotationEditorPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [quoteNo, setQuoteNo] = useState('Quote-…')
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [status, setStatus] = useState('Draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyLine()])
  const [discount, setDiscount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState(id ? Number(id) : null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (isEdit) {
          const res = await quotationsAPI.get(id)
          const q = res?.data ?? res
          if (cancelled || !q) return
          setQuoteNo(q.quoteNo)
          setQuoteDate(q.quoteDate?.slice?.(0, 10) || q.quoteDate)
          setCustomerName(q.customerName || '')
          setCustomerAddress(q.customerAddress || '')
          setStatus(q.status || 'Draft')
          setNotes(q.notes || '')
          setDiscount(q.discount || 0)
          setItems(
            (q.items || []).map((i) => ({
              description: i.description,
              unitLabel: i.unitLabel || 'Pcs',
              qty: i.qty,
              unitPrice: i.unitPrice,
              vatRate: i.vatRate || 5,
            }))
          )
          setSavedId(q.id)
        } else {
          const res = await quotationsAPI.nextNumber()
          if (!cancelled) setQuoteNo(res?.data || res || 'Quote-1')
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const totals = useMemo(() => calcQuoteTotals(items, discount, 5), [items, discount])

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyLine()])
  const removeItem = (index) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))

  const buildPayload = () => ({
    quoteDate,
    customerName,
    customerAddress,
    status,
    notes,
    discount: Number(discount) || 0,
    items: items.map((i) => ({
      description: i.description,
      unitLabel: i.unitLabel || 'Pcs',
      qty: Number(i.qty),
      unitPrice: Number(i.unitPrice),
      vatRate: Number(i.vatRate) || 5,
    })),
  })

  const save = async () => {
    setError('')
    if (!items.some((i) => i.description?.trim())) {
      setError('Add at least one line with a description')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      const res = savedId
        ? await quotationsAPI.update(savedId, payload)
        : await quotationsAPI.create(payload)
      const q = res?.data ?? res
      setSavedId(q.id)
      setQuoteNo(q.quoteNo)
      if (!isEdit) navigate(`/quotations/${q.id}`, { replace: true })
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const ensureSavedId = async () => {
    if (savedId) return savedId
    await save()
    return savedId
  }

  const handlePdf = async (format, mode) => {
    setError('')
    try {
      let qid = savedId
      if (!qid) {
        setSaving(true)
        const payload = buildPayload()
        const res = await quotationsAPI.create(payload)
        const q = res?.data ?? res
        qid = q.id
        setSavedId(qid)
        setQuoteNo(q.quoteNo)
        navigate(`/quotations/${qid}`, { replace: true })
        setSaving(false)
      }
      const blob = await quotationsAPI.getPdf(qid, format)
      if (mode === 'download') downloadBlob(blob, `${quoteNo}_${format}.pdf`)
      else openPdfBlob(blob)
    } catch (e) {
      setSaving(false)
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    }
  }

  return (
    <div className="p-3 md:p-4 h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit quotation' : 'New quotation'}</h1>
          <p className="text-xs text-text-secondary">{quoteNo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/quotations" className="px-3 py-1.5 text-sm border rounded-md">List</Link>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'download')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Download className="w-4 h-4" /> Download
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Printer className="w-4 h-4" /> Print A4
          </button>
          <button type="button" onClick={() => handlePdf('A5', 'print')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 flex-1">
        {/* Form */}
        <div className="border rounded-lg bg-white p-3 space-y-3 overflow-auto">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Date</span>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Status</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Draft">Draft</option>
                <option value="Final">Final</option>
              </select>
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">To (customer)</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Address</span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Line items</span>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-sm text-primary">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {items.map((row, idx) => {
              const calc = calcQuoteLine(row.qty, row.unitPrice, row.vatRate || 5)
              return (
                <div key={idx} className="border rounded p-2 space-y-1 bg-slate-50/50">
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="Description"
                    value={row.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                  <div className="grid grid-cols-5 gap-1">
                    <input type="number" className="border rounded px-1 py-1 text-sm" title="Qty" value={row.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} />
                    <input className="border rounded px-1 py-1 text-sm" title="Unit" value={row.unitLabel} onChange={(e) => updateItem(idx, { unitLabel: e.target.value })} />
                    <input type="number" step="0.01" className="border rounded px-1 py-1 text-sm" title="Price" value={row.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} />
                    <input type="number" className="border rounded px-1 py-1 text-sm" title="VAT %" value={row.vatRate} onChange={(e) => updateItem(idx, { vatRate: e.target.value })} />
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-600 flex items-center justify-center" aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-secondary">Tax {calc.vatAmount.toFixed(2)} · Line {calc.lineTotal.toFixed(2)}</p>
                </div>
              )
            })}
          </div>

          <label className="text-xs space-y-1 block max-w-[140px]">
            <span className="text-text-secondary">Discount</span>
            <input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Notes</span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {/* Live preview */}
        <div className="border rounded-lg bg-white p-4 overflow-auto shadow-inner">
          <div className="text-center mb-3">
            <div className="font-bold text-sm tracking-wide">QUOTATION PREVIEW</div>
            <div className="text-xs text-text-secondary">Live · updates as you type</div>
          </div>
          <div className="flex justify-between text-sm mb-3 gap-4">
            <div>
              <div className="font-semibold">To:</div>
              <div>{customerName || '—'}</div>
              <div className="text-xs whitespace-pre-wrap">{customerAddress}</div>
            </div>
            <div className="text-right text-xs">
              <div><span className="font-semibold">#</span> {quoteNo}</div>
              <div><span className="font-semibold">Date</span> {quoteDate}</div>
              <div><span className="font-semibold">Status</span> {status}</div>
            </div>
          </div>
          <p className="text-xs mb-2">Dear Sir/Madam, Thank you for your valuable inquiry. We are pleased to quote as below:</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-1 text-left">#</th>
                <th className="border p-1 text-left">Description</th>
                <th className="border p-1 text-right">Qty</th>
                <th className="border p-1 text-right">Price</th>
                <th className="border p-1 text-right">Tax</th>
                <th className="border p-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line, i) => (
                <tr key={i}>
                  <td className="border p-1">{i + 1}</td>
                  <td className="border p-1">{line.description || '—'}</td>
                  <td className="border p-1 text-right">{line.qty} {line.unitLabel}</td>
                  <td className="border p-1 text-right">{Number(line.unitPrice).toFixed(2)}</td>
                  <td className="border p-1 text-right">{line.vatAmount.toFixed(2)}</td>
                  <td className="border p-1 text-right">{line.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 ml-auto w-48 text-xs space-y-1">
            <div className="flex justify-between"><span>SUBTOTAL</span><span>AED {totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>TAX</span><span>AED {totals.vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t border-b-2 py-1"><span>GRAND TOTAL</span><span>AED {totals.grandTotal.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
