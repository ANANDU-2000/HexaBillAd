import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, Download, Printer, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsAPI } from '../../services/documentsApi'
import { productsAPI, settingsAPI } from '../../services'
import { calcQuoteLine, calcQuoteTotals } from '../../utils/quoteMath'
import QuotationProductDrawer from '../../components/QuotationProductDrawer'
import { getSetting, getSettingBool } from '../../utils/settingsKeys'

/** productsAPI returns ApiResponse; list is often nested as data.items (paged) or data (array). */
function unwrapProductList(res) {
  if (!res) return []
  if (Array.isArray(res)) return res
  if (Array.isArray(res.data)) return res.data
  if (Array.isArray(res.data?.items)) return res.data.items
  if (Array.isArray(res.items)) return res.items
  return []
}

const DEFAULT_SALUTATION = 'Dear Sir/Mam,'
const DEFAULT_INTRO = 'Thank you for your valuable inquiry. We are pleased to quote as below:'
const DEFAULT_CLOSING = 'We hope you find our offer to be in line with your requirement.'

const emptyLine = () => ({
  productId: null,
  description: '',
  descriptionSubtitle: '',
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

function formatPreviewDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
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
  const [salutation, setSalutation] = useState(DEFAULT_SALUTATION)
  const [introLine, setIntroLine] = useState(DEFAULT_INTRO)
  const [closingLine, setClosingLine] = useState(DEFAULT_CLOSING)
  const [items, setItems] = useState([emptyLine()])
  const [discount, setDiscount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState(id ? Number(id) : null)
  const [baseline, setBaseline] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState('') // '', 'saving', 'saved', 'error'
  const [company, setCompany] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    trn: '',
    logoUrl: '',
    letterheadOnly: false,
  })

  const [drawerRow, setDrawerRow] = useState(null)
  const autoSaveTimer = useRef(null)
  const persistRef = useRef(null)
  const isDirtyRef = useRef(false)
  const skipAutoSave = useRef(true)
  const [drawerSearch, setDrawerSearch] = useState('')
  const [drawerProducts, setDrawerProducts] = useState([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  const serializeForm = useCallback(
    (state) =>
      JSON.stringify({
        quoteDate: state.quoteDate,
        customerName: state.customerName,
        customerAddress: state.customerAddress,
        status: state.status,
        notes: state.notes,
        salutation: state.salutation,
        introLine: state.introLine,
        closingLine: state.closingLine,
        discount: Number(state.discount) || 0,
        items: (state.items || []).map((i) => ({
          productId: i.productId ?? null,
          description: i.description || '',
          descriptionSubtitle: i.descriptionSubtitle || '',
          unitLabel: i.unitLabel || 'Pcs',
          qty: Number(i.qty) || 0,
          unitPrice: Number(i.unitPrice) || 0,
          vatRate: Number(i.vatRate) || 5,
        })),
      }),
    []
  )

  const currentSnapshot = useMemo(
    () =>
      serializeForm({
        quoteDate,
        customerName,
        customerAddress,
        status,
        notes,
        salutation,
        introLine,
        closingLine,
        discount,
        items,
      }),
    [
      serializeForm,
      quoteDate,
      customerName,
      customerAddress,
      status,
      notes,
      salutation,
      introLine,
      closingLine,
      discount,
      items,
    ]
  )

  const isDirty = Boolean(baseline) && currentSnapshot !== baseline
  isDirtyRef.current = isDirty

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // Debounced auto-save after edits (skip first paint / load)
  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return undefined
    }
    if (!isDirty || !baseline) return undefined
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!isDirtyRef.current || !persistRef.current) return
      if (!items.some((i) => i.description?.trim())) return
      setAutoSaveStatus('saving')
      try {
        await persistRef.current()
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(''), 2000)
      } catch {
        setAutoSaveStatus('error')
      }
    }, 1200)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [currentSnapshot, isDirty, baseline, items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await settingsAPI.getCompanySettings()
        const raw = res?.data ?? res ?? {}
        const dict = raw.data && typeof raw.data === 'object' && !raw.legalNameEn ? raw.data : raw
        if (cancelled) return
        setCompany({
          name: getSetting(dict, 'legalNameEn') || getSetting(dict, 'LegalNameEn') || getSetting(dict, 'COMPANY_NAME_EN') || '',
          address: getSetting(dict, 'address') || getSetting(dict, 'Address') || getSetting(dict, 'COMPANY_ADDRESS') || '',
          phone: getSetting(dict, 'mobile') || getSetting(dict, 'Mobile') || getSetting(dict, 'COMPANY_PHONE') || '',
          email: getSetting(dict, 'email') || getSetting(dict, 'Email') || getSetting(dict, 'COMPANY_EMAIL') || '',
          trn: getSetting(dict, 'vatNumber') || getSetting(dict, 'VatNumber') || getSetting(dict, 'COMPANY_TRN') || '',
          logoUrl: getSetting(dict, 'logoPath') || getSetting(dict, 'LogoPath') || getSetting(dict, 'logoUrl') || getSetting(dict, 'LogoUrl') || getSetting(dict, 'COMPANY_LOGO') || '',
          letterheadOnly: getSettingBool(dict, 'Feature_LetterheadOnlyPrint'),
        })
      } catch {
        /* preview header optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (isEdit) {
          const res = await quotationsAPI.get(id)
          const q = res?.data ?? res
          if (cancelled || !q) return
          const mappedItems = (q.items || []).map((i) => ({
            productId: i.productId ?? null,
            description: i.description,
            descriptionSubtitle: i.descriptionSubtitle || '',
            unitLabel: i.unitLabel || 'Pcs',
            qty: i.qty,
            unitPrice: i.unitPrice,
            vatRate: i.vatRate || 5,
          }))
          const next = {
            quoteDate: q.quoteDate?.slice?.(0, 10) || q.quoteDate,
            customerName: q.customerName || '',
            customerAddress: q.customerAddress || '',
            status: q.status || 'Draft',
            notes: q.notes || '',
            salutation: q.salutation || DEFAULT_SALUTATION,
            introLine: q.introLine || DEFAULT_INTRO,
            closingLine: q.closingLine || DEFAULT_CLOSING,
            discount: q.discount || 0,
            items: mappedItems,
          }
          setQuoteNo(q.quoteNo)
          setQuoteDate(next.quoteDate)
          setCustomerName(next.customerName)
          setCustomerAddress(next.customerAddress)
          setStatus(next.status)
          setNotes(next.notes)
          setSalutation(next.salutation)
          setIntroLine(next.introLine)
          setClosingLine(next.closingLine)
          setDiscount(next.discount)
          setItems(mappedItems.length ? mappedItems : [emptyLine()])
          setSavedId(q.id)
          setBaseline(serializeForm(next))
          skipAutoSave.current = true
        } else {
          const res = await quotationsAPI.nextNumber()
          if (cancelled) return
          setQuoteNo(res?.data || res || 'Quote-1')
          const next = {
            quoteDate: new Date().toISOString().slice(0, 10),
            customerName: '',
            customerAddress: '',
            status: 'Draft',
            notes: '',
            salutation: DEFAULT_SALUTATION,
            introLine: DEFAULT_INTRO,
            closingLine: DEFAULT_CLOSING,
            discount: 0,
            items: [emptyLine()],
          }
          setBaseline(serializeForm(next))
          skipAutoSave.current = true
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, serializeForm])

  const totals = useMemo(() => calcQuoteTotals(items, discount, 5), [items, discount])

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyLine()])
  const removeItem = (index) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))

  const buildPayload = () => {
    const lineItems = items
      .filter((i) => i.description?.trim())
      .map((i) => ({
        productId: i.productId || null,
        description: i.description.trim(),
        descriptionSubtitle: i.descriptionSubtitle?.trim() || null,
        unitLabel: i.unitLabel || 'Pcs',
        qty: Number(i.qty),
        unitPrice: Number(i.unitPrice),
        vatRate: Number(i.vatRate) || 5,
      }))
    return {
      quoteDate,
      customerName,
      customerAddress,
      status,
      notes,
      salutation,
      introLine,
      closingLine,
      discount: Number(discount) || 0,
      items: lineItems,
    }
  }

  const markCleanFromState = (q) => {
    const mappedItems = (q.items || items).map((i) => ({
      productId: i.productId ?? null,
      description: i.description,
      descriptionSubtitle: i.descriptionSubtitle || '',
      unitLabel: i.unitLabel || 'Pcs',
      qty: i.qty,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate || 5,
    }))
    setBaseline(
      serializeForm({
        quoteDate: q.quoteDate?.slice?.(0, 10) || quoteDate,
        customerName: q.customerName ?? customerName,
        customerAddress: q.customerAddress ?? customerAddress,
        status: q.status || status,
        notes: q.notes ?? notes,
        salutation: q.salutation || salutation,
        introLine: q.introLine || introLine,
        closingLine: q.closingLine || closingLine,
        discount: q.discount ?? discount,
        items: mappedItems,
      })
    )
  }

  const persist = async () => {
    const payload = buildPayload()
    if (!payload.items.length) {
      throw new Error('Add at least one line with a description')
    }
    const res = savedId
      ? await quotationsAPI.update(savedId, payload)
      : await quotationsAPI.create(payload)
    const q = res?.data ?? res
    setSavedId(q.id)
    setQuoteNo(q.quoteNo)
    if (q.items?.length) {
      setItems(
        q.items.map((i) => ({
          productId: i.productId ?? null,
          description: i.description,
          descriptionSubtitle: i.descriptionSubtitle || '',
          unitLabel: i.unitLabel || 'Pcs',
          qty: i.qty,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate || 5,
        }))
      )
    }
    markCleanFromState(q)
    if (!isEdit && q.id) navigate(`/quotations/${q.id}`, { replace: true })
    return q.id
  }
  persistRef.current = persist

  const onLineKeyDown = (e, rowIdx, field) => {
    const order = ['description', 'descriptionSubtitle', 'qty', 'unitLabel', 'unitPrice', 'vatRate']
    if (e.key === 'Enter') {
      e.preventDefault()
      if (field === 'vatRate') {
        if (rowIdx === items.length - 1) addItem()
        requestAnimationFrame(() => {
          document.querySelector(`[data-quote-cell="${rowIdx + 1}-description"]`)?.focus()
        })
      } else {
        const next = order[order.indexOf(field) + 1]
        document.querySelector(`[data-quote-cell="${rowIdx}-${next}"]`)?.focus()
      }
      return
    }
    if (e.key === 'Tab' && !e.shiftKey && field === 'vatRate' && rowIdx === items.length - 1) {
      e.preventDefault()
      addItem()
      requestAnimationFrame(() => {
        document.querySelector(`[data-quote-cell="${rowIdx + 1}-description"]`)?.focus()
      })
    }
  }

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      await persist()
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePdf = async (format, mode, layout = 'full') => {
    setError('')
    setSaving(true)
    try {
      let qid = savedId
      if (!qid || isDirty) {
        qid = await persist()
      }
      const blob = await quotationsAPI.getPdf(qid, format, layout)
      const name = `${quoteNo || 'Quote'}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    } finally {
      setSaving(false)
    }
  }

  const openDrawer = (idx) => {
    setDrawerRow(idx)
    setDrawerSearch(items[idx]?.description || '')
    setDrawerProducts([])
  }

  const closeDrawer = () => {
    setDrawerRow(null)
    setDrawerSearch('')
    setDrawerProducts([])
  }

  useEffect(() => {
    if (drawerRow == null) return undefined
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setDrawerLoading(true)
      try {
        const q = drawerSearch.trim()
        const res = q
          ? await productsAPI.searchProducts(q, 40)
          : await productsAPI.getProducts({ page: 1, pageSize: 40 })
        setDrawerProducts(unwrapProductList(res))
      } catch {
        setDrawerProducts([])
        toast.error('Could not load products')
      } finally {
        setDrawerLoading(false)
      }
    }, 200)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [drawerRow, drawerSearch])

  const selectProduct = (product) => {
    if (drawerRow == null) return
    const name = product.nameEn || product.name || product.NameEn || ''
    const price = Number(product.sellPrice ?? product.SellPrice ?? 0)
    const unit = product.unit || product.Unit || product.unitLabel || 'Pcs'
    updateItem(drawerRow, {
      productId: product.id ?? product.Id,
      description: name,
      unitPrice: price,
      unitLabel: unit,
    })
    closeDrawer()
  }

  const contactLine = [company.phone, company.email, company.trn].filter(Boolean).join('  |  ')

  return (
    <div className="p-2 md:p-3 w-full max-w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit quotation' : 'New quotation'}</h1>
          <p className="text-xs text-text-secondary">
            {quoteNo}
            {isDirty ? <span className="ml-2 text-amber-700 font-medium">· Unsaved changes</span> : null}
            {autoSaveStatus === 'saving' ? <span className="ml-2 text-text-secondary">· Auto-saving…</span> : null}
            {autoSaveStatus === 'saved' ? <span className="ml-2 text-green-700">· Auto-saved</span> : null}
            {autoSaveStatus === 'error' ? <span className="ml-2 text-red-600">· Auto-save failed</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/quotations" className="px-3 py-1.5 text-sm border rounded-md">List</Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md disabled:opacity-50 ${
              isDirty ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'border text-text-secondary bg-slate-50'
            }`}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'download', 'full')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50">
            <Download className="w-4 h-4" /> Download
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print', 'body')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50" title="Print on letterhead paper">
            <Printer className="w-4 h-4" /> Print Letterhead
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print', 'full')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50" title="Print full with digital header">
            <Printer className="w-4 h-4" /> Print Full
          </button>
          <button type="button" onClick={() => handlePdf('A5', 'print', 'body')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <div className="border rounded-lg bg-white p-2.5 space-y-2">
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
            <span className="text-text-secondary">Client name</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Blank until typed" />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Address</span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Multi-line address" />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Salutation</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={salutation} onChange={(e) => setSalutation(e.target.value)} />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Intro</span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={introLine} onChange={(e) => setIntroLine(e.target.value)} />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Closing</span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={closingLine} onChange={(e) => setClosingLine(e.target.value)} />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Line items</span>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-sm text-primary">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs table-fixed">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-1 text-left w-[38%]">Description</th>
                    <th className="p-1 text-right w-[8%]">Qty</th>
                    <th className="p-1 text-left w-[8%]">Unit</th>
                    <th className="p-1 text-right w-[12%]">Price</th>
                    <th className="p-1 text-right w-[8%]">VAT%</th>
                    <th className="p-1 text-right w-[10%]">Tax</th>
                    <th className="p-1 text-right w-[12%]">Total</th>
                    <th className="p-1 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const calc = calcQuoteLine(row.qty, row.unitPrice, row.vatRate || 5)
                    return (
                      <tr key={idx} className="border-t align-top">
                        <td className="p-1">
                          <div className="flex gap-1">
                            <input
                              data-quote-cell={`${idx}-description`}
                              className="w-full min-w-0 border rounded px-1 py-1"
                              value={row.description}
                              onChange={(e) => updateItem(idx, { description: e.target.value, productId: null })}
                              onFocus={() => openDrawer(idx)}
                              onKeyDown={(e) => onLineKeyDown(e, idx, 'description')}
                              placeholder="Search or type"
                            />
                            <button type="button" className="shrink-0 px-1 text-primary" title="Search products" onClick={() => openDrawer(idx)}>
                              <Search className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            data-quote-cell={`${idx}-descriptionSubtitle`}
                            className="mt-1 w-full border rounded px-1 py-1 text-[11px] text-text-secondary"
                            placeholder="Subtitle (optional)"
                            value={row.descriptionSubtitle}
                            onChange={(e) => updateItem(idx, { descriptionSubtitle: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'descriptionSubtitle')}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            data-quote-cell={`${idx}-qty`}
                            type="number"
                            className="w-full border rounded px-1 py-1 text-right"
                            value={row.qty}
                            onChange={(e) => updateItem(idx, { qty: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'qty')}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            data-quote-cell={`${idx}-unitLabel`}
                            className="w-full border rounded px-1 py-1"
                            value={row.unitLabel}
                            onChange={(e) => updateItem(idx, { unitLabel: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'unitLabel')}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            data-quote-cell={`${idx}-unitPrice`}
                            type="number"
                            step="0.01"
                            className="w-full border rounded px-1 py-1 text-right"
                            value={row.unitPrice}
                            onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'unitPrice')}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            data-quote-cell={`${idx}-vatRate`}
                            type="number"
                            className="w-full border rounded px-1 py-1 text-right"
                            value={row.vatRate}
                            onChange={(e) => updateItem(idx, { vatRate: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'vatRate')}
                          />
                        </td>
                        <td className="p-1 text-right whitespace-nowrap">
                          <div>{calc.vatAmount.toFixed(2)}</div>
                          <div className="text-[10px] text-text-secondary">{Number(row.vatRate || 5).toFixed(2)}%</div>
                        </td>
                        <td className="p-1 text-right">{calc.lineTotal.toFixed(2)}</td>
                        <td className="p-1">
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-600" aria-label="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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

        <div className="border rounded-lg bg-white p-3 shadow-inner">
          <div className="flex justify-between items-start gap-3 mb-3">
            {!company.letterheadOnly ? (
              <div className="flex gap-2 min-w-0 flex-1">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="" className="h-10 w-10 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : null}
                <div className="text-center flex-1 min-w-0">
                  <div className="font-bold text-xs uppercase leading-tight">{company.name || 'Company'}</div>
                  {company.address ? <div className="text-[10px] text-text-secondary whitespace-pre-wrap">{company.address}</div> : null}
                  {contactLine ? <div className="text-[10px] text-text-secondary">{contactLine}</div> : null}
                </div>
              </div>
            ) : (
              <div className="flex-1 text-[10px] text-text-secondary italic">Letterhead paper (body only)</div>
            )}
            <div className="text-lg font-bold shrink-0">Quotation</div>
          </div>
          <div className="flex justify-between text-sm mb-3 gap-4">
            <div>
              <div className="font-semibold text-xs">To</div>
              <div className="font-medium">{customerName || '—'}</div>
              <div className="text-xs whitespace-pre-wrap">{customerAddress}</div>
            </div>
            <div className="text-right text-xs">
              <div><span className="font-semibold">Quotation#</span> {quoteNo}</div>
              <div><span className="font-semibold">Date</span> {formatPreviewDate(quoteDate)}</div>
            </div>
          </div>
          <p className="text-sm mb-1">{salutation}</p>
          <p className="text-xs mb-3">{introLine}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-b p-1 text-left">#</th>
                <th className="border-b p-1 text-left">DESCRIPTION</th>
                <th className="border-b p-1 text-right">QTY</th>
                <th className="border-b p-1 text-right">PRICE</th>
                <th className="border-b p-1 text-right">TAX</th>
                <th className="border-b p-1 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line, i) => (
                <tr key={i} className="align-top">
                  <td className="border-b p-1">{i + 1}</td>
                  <td className="border-b p-1">
                    <div className="font-medium">{line.description || '—'}</div>
                    {line.descriptionSubtitle ? <div className="text-[10px] text-text-secondary">{line.descriptionSubtitle}</div> : null}
                  </td>
                  <td className="border-b p-1 text-right">
                    <div>{line.qty}</div>
                    <div className="text-[10px] text-text-secondary">{line.unitLabel}</div>
                  </td>
                  <td className="border-b p-1 text-right">AED {Number(line.unitPrice).toFixed(2)}</td>
                  <td className="border-b p-1 text-right">
                    <div>AED {line.vatAmount.toFixed(2)}</div>
                    <div className="text-[10px] text-text-secondary">{Number(line.vatRate).toFixed(2)}%</div>
                  </td>
                  <td className="border-b p-1 text-right">AED {line.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 ml-auto w-52 text-xs space-y-1">
            <div className="flex justify-between"><span>SUBTOTAL</span><span>AED {totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>TAX</span><span>AED {totals.vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t border-b-2 py-1"><span>GRAND TOTAL</span><span>AED {totals.grandTotal.toFixed(2)}</span></div>
          </div>
          <p className="text-xs mt-4">{closingLine}</p>
          {!company.letterheadOnly ? (
            <div className="mt-8 ml-auto w-40 text-center text-xs">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="" className="h-8 mx-auto object-contain mb-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="h-8" />
              )}
              <div className="font-semibold border-t pt-1">AUTHORIZED SIGNATURE</div>
              {company.name ? <div className="text-[10px] text-text-secondary mt-0.5">{company.name}</div> : null}
            </div>
          ) : (
            <div className="mt-10 text-[10px] text-text-secondary text-right italic">Stamp / signature zone (pre-printed)</div>
          )}
        </div>
      </div>

      <QuotationProductDrawer
        open={drawerRow != null}
        rowIndex={drawerRow}
        searchValue={drawerSearch}
        onSearchChange={setDrawerSearch}
        onClose={closeDrawer}
        searchRef={searchRef}
        loading={drawerLoading}
        products={drawerProducts}
        onSelect={selectProduct}
      />
    </div>
  )
}
