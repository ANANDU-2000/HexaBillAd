import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, Download, Printer, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsAPI } from '../../services/documentsApi'
import { productsAPI, settingsAPI, customersAPI, adminAPI } from '../../services/index'
import { calcQuoteLine, calcQuoteTotals } from '../../utils/quoteMath'
import QuotationProductDrawer from '../../components/QuotationProductDrawer'
import { getSetting, getSettingBool } from '../../utils/settingsKeys'
import { localDateString } from '../../utils/dateFormat'
import { useAuthedImageSrc } from '../../utils/useAuthedImageSrc'
import { useBranding } from '../../tenant/TenantBrandingContext'
import BackLink from '../../components/ui/BackLink'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import { reserveTab, showPdf, closeTab, downloadBlob } from '../../utils/pdfOpen'

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

let tempIdSeq = 0
/** Stable per-row React key so rows never collide when the list is edited. */
const newTempId = () => `q${Date.now().toString(36)}-${++tempIdSeq}`

const UNITS = ['Pcs', 'CRTN', 'KG', 'PKT', 'BOX', 'BAG', 'LTR', 'DOZ', 'TIN']
const STATUSES = ['Draft', 'Final', 'Sent', 'Accepted', 'Rejected', 'Expired']

const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

/** Row problems that must be fixed before a quotation can be saved (blank rows are ignored). */
function lineIssue(row) {
  if (!row.description?.trim()) return ''
  if (!(Number(row.qty) > 0)) return 'Quantity must be greater than 0'
  if (!(Number(row.unitPrice) > 0)) return 'Price must be greater than 0'
  return ''
}

const emptyLine = () => ({
  tempId: newTempId(),
  productId: null,
  description: '',
  descriptionSubtitle: '',
  unitLabel: 'Pcs',
  qty: 1,
  unitPrice: 0,
  vatRate: 5,
})


function formatPreviewDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

export default function QuotationEditorPage() {
  const { currency = 'AED' } = useBranding()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const copyId = searchParams.get('copy')
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [quoteNo, setQuoteNo] = useState('Quote-…')
  const [quoteDate, setQuoteDate] = useState(() => localDateString())
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerTrn, setCustomerTrn] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerId, setCustomerId] = useState(null)
  const [validUntil, setValidUntil] = useState('')
  const [subject, setSubject] = useState('')
  const [terms, setTerms] = useState('')
  const [defaults, setDefaults] = useState({ validDays: 30, terms: '' })
  const [customerHits, setCustomerHits] = useState([])
  const customerTimer = useRef(null)
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

  // UIX-003: the logo is a tenant storage URL, so it must load with the auth header.
  const companyLogoSrc = useAuthedImageSrc(company.logoUrl)

  const [drawerRow, setDrawerRow] = useState(null)
  const autoSaveTimer = useRef(null)
  const persistRef = useRef(null)
  const justSavedIdRef = useRef(null)
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
        customerTrn: state.customerTrn || '',
        customerPhone: state.customerPhone || '',
        customerEmail: state.customerEmail || '',
        customerId: state.customerId ?? null,
        validUntil: state.validUntil || '',
        subject: state.subject || '',
        terms: state.terms || '',
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
        customerTrn,
        customerPhone,
        customerEmail,
        customerId,
        validUntil,
        subject,
        terms,
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
      customerTrn,
      customerPhone,
      customerEmail,
      customerId,
      validUntil,
      subject,
      terms,
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
  useUnsavedChangesGuard(isDirty)

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
      if (items.some((i) => lineIssue(i))) return
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
          // Just created in this session (create -> navigate): local rows are newer than the server copy.
          if (Number(q.id) === justSavedIdRef.current) return
          const mappedItems = (q.items || []).map((i) => ({
            tempId: newTempId(),
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
            customerTrn: q.customerTrn || '',
            customerPhone: q.customerPhone || '',
            customerEmail: q.customerEmail || '',
            customerId: q.customerId ?? null,
            validUntil: q.validUntil?.slice?.(0, 10) || '',
            subject: q.subject || '',
            terms: q.termsAndConditions || '',
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
          setCustomerTrn(next.customerTrn)
          setCustomerPhone(next.customerPhone)
          setCustomerEmail(next.customerEmail)
          setCustomerId(next.customerId)
          setValidUntil(next.validUntil)
          setSubject(next.subject)
          setTerms(next.terms)
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
          let d = null
          try {
            d = (await quotationsAPI.defaults())?.data
          } catch {
            /* fall back to plain numbering below */
          }
          const today = localDateString()
          let nextNo = d?.nextQuoteNo
          if (!nextNo) {
            const res = await quotationsAPI.nextNumber()
            nextNo = res?.data || res || 'Quote-1'
          }
          if (cancelled) return
          setQuoteNo(nextNo)
          const validDays = d?.validDays > 0 ? d.validDays : 30
          const defTerms = d?.terms || ''
          setDefaults({ validDays, terms: defTerms })
          setValidUntil(addDays(today, validDays))
          setTerms(defTerms)
          const next = {
            quoteDate: today,
            customerName: '',
            customerAddress: '',
            customerTrn: '',
            customerPhone: '',
            customerEmail: '',
            customerId: null,
            validUntil: addDays(today, validDays),
            subject: '',
            terms: defTerms,
            status: 'Draft',
            notes: '',
            salutation: DEFAULT_SALUTATION,
            introLine: DEFAULT_INTRO,
            closingLine: DEFAULT_CLOSING,
            discount: 0,
            items: [emptyLine()],
          }
          // Duplicate: start from an existing quotation but as a fresh Draft with today's dates.
          if (copyId) {
            try {
              const src = (await quotationsAPI.get(copyId))?.data
              if (src && !cancelled) {
                const copyItems = (src.items || []).map((i) => ({
                  tempId: newTempId(),
                  productId: i.productId ?? null,
                  description: i.description,
                  descriptionSubtitle: i.descriptionSubtitle || '',
                  unitLabel: i.unitLabel || 'Pcs',
                  qty: i.qty,
                  unitPrice: i.unitPrice,
                  vatRate: i.vatRate || 5,
                }))
                Object.assign(next, {
                  customerName: src.customerName || '',
                  customerAddress: src.customerAddress || '',
                  customerTrn: src.customerTrn || '',
                  customerPhone: src.customerPhone || '',
                  customerEmail: src.customerEmail || '',
                  customerId: src.customerId ?? null,
                  subject: src.subject || '',
                  terms: src.termsAndConditions || defTerms,
                  notes: src.notes || '',
                  salutation: src.salutation || DEFAULT_SALUTATION,
                  introLine: src.introLine || DEFAULT_INTRO,
                  closingLine: src.closingLine || DEFAULT_CLOSING,
                  discount: src.discount || 0,
                  items: copyItems.length ? copyItems : next.items,
                })
                setCustomerName(next.customerName)
                setCustomerAddress(next.customerAddress)
                setCustomerTrn(next.customerTrn)
                setCustomerPhone(next.customerPhone)
                setCustomerEmail(next.customerEmail)
                setCustomerId(next.customerId)
                setSubject(next.subject)
                setTerms(next.terms)
                setNotes(next.notes)
                setSalutation(next.salutation)
                setIntroLine(next.introLine)
                setClosingLine(next.closingLine)
                setDiscount(next.discount)
                setItems(next.items)
              }
            } catch {
              /* copy source missing: fall back to a blank quotation */
            }
          }
          setBaseline(serializeForm(next))
          skipAutoSave.current = true
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, copyId, serializeForm])

  const totals = useMemo(() => calcQuoteTotals(items, discount, 5), [items, discount])

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const onCustomerNameChange = (value) => {
    setCustomerName(value)
    setCustomerId(null)
    if (customerTimer.current) clearTimeout(customerTimer.current)
    if (value.trim().length < 2) {
      setCustomerHits([])
      return
    }
    customerTimer.current = setTimeout(async () => {
      try {
        const res = await customersAPI.searchCustomers(value.trim(), 6)
        setCustomerHits(res?.data || [])
      } catch {
        setCustomerHits([])
      }
    }, 250)
  }

  const pickCustomer = (c) => {
    setCustomerName(c.name || '')
    setCustomerAddress(c.address || c.Address || '')
    setCustomerTrn(c.trn || c.Trn || '')
    setCustomerPhone(c.phone || c.Phone || '')
    setCustomerEmail(c.email || c.Email || '')
    setCustomerId(c.id ?? null)
    setCustomerHits([])
  }

  const saveTermsAsDefault = async () => {
    try {
      await adminAPI.updateSettings({ QUOTE_TERMS: terms || '', QUOTE_VALID_DAYS: String(defaults.validDays || 30) })
      setDefaults((d) => ({ ...d, terms }))
      toast.success('Saved as your default terms for new quotations')
    } catch (e) {
      toast.error(e?.response?.status === 403 ? 'Only an Owner or Admin can change default terms' : 'Could not save default terms')
    }
  }

  const addItem = () => setItems((prev) => [...prev, emptyLine()])
  const removeItem = (index) => {
    setDrawerRow(null)
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

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
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      customerId: customerId || null,
      customerTrn: customerTrn || null,
      validUntil: validUntil || null,
      subject: subject || null,
      termsAndConditions: terms || null,
      status,
      notes,
      salutation,
      introLine,
      closingLine,
      discount: Number(discount) || 0,
      items: lineItems,
    }
  }

  const persist = async () => {
    const payload = buildPayload()
    if (!payload.items.length) {
      throw new Error('Add at least one line with a description')
    }
    const badRow = items.findIndex((i) => lineIssue(i))
    if (badRow >= 0) {
      throw new Error(`Item ${badRow + 1}: ${lineIssue(items[badRow])}`)
    }
    // Snapshot of exactly what is being sent; edits made while the request is in flight stay dirty.
    const sentSnapshot = serializeForm({
      quoteDate, customerName, customerAddress, customerTrn, customerPhone, customerEmail, customerId,
      validUntil, subject, terms, status, notes, salutation, introLine, closingLine, discount, items,
    })
    const res = savedId
      ? await quotationsAPI.update(savedId, payload)
      : await quotationsAPI.create(payload)
    const q = res?.data ?? res
    // Never replace local rows with the server copy: the server drops blank rows and any rows
    // added/edited during the request, which made new products overwrite or vanish.
    justSavedIdRef.current = Number(q.id)
    setSavedId(q.id)
    setQuoteNo(q.quoteNo)
    setBaseline(sentSnapshot)
    window.dispatchEvent(new CustomEvent('dataUpdated'))
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
      setError(e?.response?.data?.message || e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePdf = async (format, mode, layout = 'full') => {
    setError('')
    // Must happen synchronously inside the click, before any await, or browsers block the tab.
    const tab = mode === 'download' ? null : reserveTab()
    setSaving(true)
    try {
      let qid = savedId
      if (!qid || isDirty) {
        qid = await persist()
      }
      const blob = await quotationsAPI.getPdf(qid, format, layout)
      const name = `${quoteNo || 'Quote'}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else showPdf(blob, name, tab)
    } catch (e) {
      closeTab(tab)
      setError(e?.response?.data?.message || e?.message || 'PDF failed')
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
    if (product.__custom) {
      updateItem(drawerRow, { productId: null, description: product.name })
      closeDrawer()
      return
    }
    const name = product.nameEn || product.name || product.NameEn || ''
    const price = Number(product.sellPrice ?? product.SellPrice ?? 0)
    // Backend ProductDto sends UnitType (CRTN/KG/PCS); also accept camel/Pascal variants.
    const unit = product.UnitType || product.unitType || product.unit || product.Unit || product.unitLabel || 'Pcs'
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
      <BackLink to="/quotations" label="Back to quotations" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit quotation' : 'New quotation'}</h1>
          <p className="text-xs text-text-secondary">
            {quoteNo}
            {isDirty ? <span className="ml-2 text-warning-fg font-medium">· Unsaved changes</span> : null}
            {autoSaveStatus === 'saving' ? <span className="ml-2 text-text-secondary">· Auto-saving…</span> : null}
            {autoSaveStatus === 'saved' ? <span className="ml-2 text-success-fg">· Auto-saved</span> : null}
            {autoSaveStatus === 'error' ? <span className="ml-2 text-error">· Auto-save failed</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/quotations" className="px-3 py-1.5 text-sm border rounded-md">List</Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm rounded-md disabled:opacity-50 ${
 isDirty ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'border text-text-secondary bg-slate-50'
 }`}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'download', 'full')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm border rounded-md disabled:opacity-50">
            <Download className="w-4 h-4" /> Download
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print', 'body')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm border rounded-md disabled:opacity-50" title="Print on letterhead paper">
            <Printer className="w-4 h-4" /> Print Letterhead
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print', 'full')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm border rounded-md disabled:opacity-50" title="Print full with digital header">
            <Printer className="w-4 h-4" /> Print Full
          </button>
          <button type="button" onClick={() => handlePdf('A5', 'print', 'body')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] text-sm border rounded-md disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-neutral-800 bg-white border border-neutral-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <div className="border rounded-lg bg-white p-2.5 space-y-2">
          <fieldset className="border rounded-lg p-2 space-y-2">
            <legend className="px-1 text-xs font-semibold text-text-secondary">Quotation details</legend>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <label className="text-xs space-y-1">
                <span className="text-text-secondary">Date</span>
                <input type="date" className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-text-secondary">Valid until</span>
                <input type="date" min={quoteDate} className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </label>
              <label className="text-xs space-y-1 col-span-2 lg:col-span-1">
                <span className="text-text-secondary">Status</span>
                <select className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs space-y-1 block">
              <span className="text-text-secondary">Subject (optional)</span>
              <input aria-label="e.g. Supply of frozen meat" className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Supply of frozen meat" />
            </label>
          </fieldset>

          <fieldset className="border rounded-lg p-2 space-y-2">
            <legend className="px-1 text-xs font-semibold text-text-secondary">Customer</legend>
            <div className="relative">
              <label className="text-xs space-y-1 block">
                <span className="text-text-secondary">Client name {customerId ? <span className="text-success-fg">· linked customer</span> : <span>· type to search saved customers</span>}</span>
                <input aria-label="Customer or company name" className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} onBlur={() => setTimeout(() => setCustomerHits([]), 150)} placeholder="Customer or company name" autoComplete="off" />
              </label>
              {customerHits.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-md shadow-sm max-h-56 overflow-auto" role="listbox">
                  {customerHits.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="w-full text-left px-3 py-2 min-h-11 hover:bg-slate-50 text-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => pickCustomer(h)}>
                        <span className="font-medium">{h.name}</span>
                        {(h.trn || h.phone) ? <span className="ml-2 text-xs text-text-secondary">{[h.trn, h.phone].filter(Boolean).join(' · ')}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs space-y-1 block">
                <span className="text-text-secondary">Customer TRN</span>
                <input aria-label="15-digit TRN" className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" maxLength={50} inputMode="numeric" value={customerTrn} onChange={(e) => setCustomerTrn(e.target.value)} placeholder="15-digit TRN" />
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-text-secondary">Phone</span>
                <input className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" maxLength={50} inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </label>
            </div>
            <label className="text-xs space-y-1 block">
              <span className="text-text-secondary">Address</span>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Multi-line address" />
            </label>
          </fieldset>

          <fieldset className="border rounded-lg p-2 space-y-2">
            <legend className="px-1 text-xs font-semibold text-text-secondary">Letter text</legend>
            <label className="text-xs space-y-1 block">
              <span className="text-text-secondary">Salutation</span>
              <input className="w-full min-h-11 md:min-h-0 border rounded px-2 py-1.5 text-sm" value={salutation} onChange={(e) => setSalutation(e.target.value)} />
            </label>
            <label className="text-xs space-y-1 block">
              <span className="text-text-secondary">Intro</span>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={introLine} onChange={(e) => setIntroLine(e.target.value)} />
            </label>
            <label className="text-xs space-y-1 block">
              <span className="text-text-secondary">Closing</span>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={closingLine} onChange={(e) => setClosingLine(e.target.value)} />
            </label>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Line items</span>
              <button type="button" onClick={addItem} className="hidden md:inline-flex items-center gap-1 px-2 min-h-9 text-sm text-primary">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <datalist id="quote-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            {items.some((i) => lineIssue(i)) && (
              <p className="text-xs text-error" role="alert">
                {items.map((i, n) => (lineIssue(i) ? `Item ${n + 1}: ${lineIssue(i)}` : null)).filter(Boolean).join(' · ')} — not saved until fixed.
              </p>
            )}
            {/* Phone: one card per line, no sideways scrolling */}
            <ul className="md:hidden space-y-2" aria-label="Line items">
              {items.map((row, idx) => {
                const calc = calcQuoteLine(row.qty, row.unitPrice, row.vatRate || 5)
                const field = 'w-full min-h-11 border rounded px-2 text-sm'
                return (
                  <li key={row.tempId ?? idx} className="border rounded-lg p-2 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Item {idx + 1}</span>
                      <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1} className="min-h-11 min-w-11 inline-flex items-center justify-center text-error disabled:opacity-40" aria-label={`Remove item ${idx + 1}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={field}
                        value={row.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value, productId: null })}
                        onFocus={() => { if (!row.description?.trim()) openDrawer(idx) }}
                        placeholder="Tap to pick a product or type"
                        aria-label={`Item ${idx + 1} description`}
                      />
                      <button type="button" className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center border rounded text-primary" onClick={() => openDrawer(idx)} aria-label="Search products">
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                    <input className={field} placeholder="Subtitle (optional)" value={row.descriptionSubtitle} onChange={(e) => updateItem(idx, { descriptionSubtitle: e.target.value })} aria-label={`Item ${idx + 1} subtitle`} />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-micro text-text-secondary">Qty
                        <input type="number" inputMode="decimal" className={`${field} text-right`} value={row.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} />
                      </label>
                      <label className="text-micro text-text-secondary">Unit
                        <input list="quote-units" className={field} value={row.unitLabel} onChange={(e) => updateItem(idx, { unitLabel: e.target.value })} />
                      </label>
                      <label className="text-micro text-text-secondary">VAT %
                        <input type="number" inputMode="decimal" className={`${field} text-right`} value={row.vatRate} onChange={(e) => updateItem(idx, { vatRate: e.target.value })} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <label className="text-micro text-text-secondary">Price
                        <input type="number" inputMode="decimal" step="0.01" min="0" className={`${field} text-right ${Number(row.unitPrice) > 0 || !row.description?.trim() ? '' : 'border-error'}`} value={row.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} />
                      </label>
                      <div className="text-right text-sm">
                        <div className="text-micro text-text-secondary">Tax {calc.vatAmount.toFixed(2)}</div>
                        <div className="font-semibold tabular-nums">{currency} {calc.lineTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <button type="button" onClick={addItem} className="md:hidden w-full min-h-11 inline-flex items-center justify-center gap-1 border border-dashed rounded-lg text-sm text-primary">
              <Plus className="w-4 h-4" /> Add another item
            </button>
            <div className="hidden md:block overflow-x-auto border rounded">
              <table className="min-w-[40rem] w-full text-xs">
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
                      <tr key={row.tempId ?? idx} className="border-t align-top">
                        <td className="p-1">
                          <div className="flex gap-1">
                            <input aria-label="Search or type"
                              data-quote-cell={`${idx}-description`}
                              className="w-full min-w-0 border rounded px-1 py-1"
                              value={row.description}
                              onChange={(e) => updateItem(idx, { description: e.target.value, productId: null })}
                              onFocus={() => { if (!row.description?.trim()) openDrawer(idx) }}
                              onClick={() => { if (!row.description?.trim()) openDrawer(idx) }}
                              onKeyDown={(e) => onLineKeyDown(e, idx, 'description')}
                              placeholder="Search or type"
                            />
                            <button type="button" className="shrink-0 px-1 text-primary" title="Search products" onClick={() => openDrawer(idx)}>
                              <Search className="w-4 h-4" />
                            </button>
                          </div>
                          <input aria-label="Subtitle (optional)"
                            data-quote-cell={`${idx}-descriptionSubtitle`}
                            className="mt-1 w-full border rounded px-1 py-1 text-micro text-text-secondary"
                            placeholder="Subtitle (optional)"
                            value={row.descriptionSubtitle}
                            onChange={(e) => updateItem(idx, { descriptionSubtitle: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'descriptionSubtitle')}
                          />
                        </td>
                        <td className="p-1">
                          <input aria-label="Number"
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
                            list="quote-units"
                            className="w-full border rounded px-1 py-1"
                            value={row.unitLabel}
                            onChange={(e) => updateItem(idx, { unitLabel: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'unitLabel')}
                          />
                        </td>
                        <td className="p-1">
                          <input aria-label="Number"
                            data-quote-cell={`${idx}-unitPrice`}
                            type="number"
                            step="0.01"
                            min="0"
                            className={`w-full border rounded px-1 py-1 text-right ${Number(row.unitPrice) > 0 || !row.description?.trim() ? '' : 'border-error'}`}
                            value={row.unitPrice}
                            onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, idx, 'unitPrice')}
                          />
                        </td>
                        <td className="p-1">
                          <input aria-label="Number"
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
                          <div className="text-micro text-text-secondary">{Number(row.vatRate || 5).toFixed(2)}%</div>
                        </td>
                        <td className="p-1 text-right">{calc.lineTotal.toFixed(2)}</td>
                        <td className="p-1">
                          <button type="button" onClick={() => removeItem(idx)} className="text-error" aria-label="Remove">
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
            <span className="flex items-center justify-between text-text-secondary">
              <span>Terms &amp; conditions (printed on the PDF)</span>
              <button type="button" onClick={saveTermsAsDefault} disabled={terms === defaults.terms} className="min-h-9 px-2 text-primary disabled:opacity-40">Save as my default</button>
            </span>
            <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="1. Prices valid for 30 days.&#10;2. Payment terms..." />
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
                {companyLogoSrc ? (
                  <img src={companyLogoSrc} alt="" className="h-10 w-10 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : null}
                <div className="text-center flex-1 min-w-0">
                  <div className="font-bold text-xs leading-tight">{company.name || 'Company'}</div>
                  {company.address ? <div className="text-micro text-text-secondary whitespace-pre-wrap">{company.address}</div> : null}
                  {contactLine ? <div className="text-micro text-text-secondary">{contactLine}</div> : null}
                </div>
              </div>
            ) : (
              <div className="flex-1 text-micro text-text-secondary italic">Letterhead paper (body only)</div>
            )}
            <div className="text-lg font-bold shrink-0">Quotation</div>
          </div>
          <div className="flex justify-between text-sm mb-3 gap-4">
            <div>
              <div className="font-semibold text-xs">To</div>
              <div className="font-medium">{customerName || '—'}</div>
              <div className="text-xs whitespace-pre-wrap">{customerAddress}</div>
              {customerTrn ? <div className="text-xs">TRN: {customerTrn}</div> : null}
            </div>
            <div className="text-right text-xs">
              <div><span className="font-semibold">Quotation#</span> {quoteNo}</div>
              <div><span className="font-semibold">Date</span> {formatPreviewDate(quoteDate)}</div>
              {validUntil ? <div><span className="font-semibold">Valid until</span> {formatPreviewDate(validUntil)}</div> : null}
            </div>
          </div>
          {subject ? <p className="text-sm font-semibold mb-1">Subject: {subject}</p> : null}
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
                    {line.descriptionSubtitle ? <div className="text-micro text-text-secondary">{line.descriptionSubtitle}</div> : null}
                  </td>
                  <td className="border-b p-1 text-right">
                    <div>{line.qty}</div>
                    <div className="text-micro text-text-secondary">{line.unitLabel}</div>
                  </td>
                  <td className="border-b p-1 text-right">{currency} {Number(line.unitPrice).toFixed(2)}</td>
                  <td className="border-b p-1 text-right">
                    <div>{currency} {line.vatAmount.toFixed(2)}</div>
                    <div className="text-micro text-text-secondary">{Number(line.vatRate).toFixed(2)}%</div>
                  </td>
                  <td className="border-b p-1 text-right">{currency} {line.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 ml-auto w-52 text-xs space-y-1">
            <div className="flex justify-between"><span>SUBTOTAL</span><span>{currency} {totals.subtotal.toFixed(2)}</span></div>
            {Number(discount) > 0 ? <div className="flex justify-between"><span>DISCOUNT</span><span>- {currency} {Number(discount).toFixed(2)}</span></div> : null}
            <div className="flex justify-between"><span>TAX</span><span>{currency} {totals.vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t border-b-2 py-1"><span>GRAND TOTAL</span><span>{currency} {totals.grandTotal.toFixed(2)}</span></div>
          </div>
          {terms ? (
            <div className="mt-3 text-xs">
              <div className="font-semibold">Terms &amp; Conditions</div>
              <div className="whitespace-pre-wrap">{terms}</div>
            </div>
          ) : null}
          <p className="text-xs mt-4">{closingLine}</p>
          {!company.letterheadOnly ? (
            <div className="mt-8 ml-auto w-40 text-center text-xs">
              {companyLogoSrc ? (
                <img src={companyLogoSrc} alt="" className="h-8 mx-auto object-contain mb-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="h-8" />
              )}
              <div className="font-semibold border-t pt-1">AUTHORIZED SIGNATURE</div>
              {company.name ? <div className="text-micro text-text-secondary mt-0.5">{company.name}</div> : null}
            </div>
          ) : (
            <div className="mt-10 text-micro text-text-secondary text-right italic">Stamp / signature zone (pre-printed)</div>
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
        allowCustom
      />
    </div>
  )
}
