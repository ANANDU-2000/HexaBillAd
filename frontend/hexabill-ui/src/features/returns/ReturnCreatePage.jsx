/*
 * Return Create Page – ERP-style sales return from an invoice.
 * Route: /returns/create?saleId=...
 */
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, FileText } from 'lucide-react'
import { salesAPI, returnsAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'

const CONDITION_OPTIONS = [
  { value: 'resellable', label: 'Resellable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'writeoff', label: 'Write Off' }
]

export default function ReturnCreatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const saleId = searchParams.get('saleId')
  const returnTo = location.state?.returnTo

  const [loading, setLoading] = useState(!!searchParams.get('saleId'))
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sale, setSale] = useState(null)
  const [damageCategories, setDamageCategories] = useState([])
  const [existingReturns, setExistingReturns] = useState([])
  const [reason, setReason] = useState('')
  const [reasonCategoryId, setReasonCategoryId] = useState(null)
  const [lines, setLines] = useState([])

  useEffect(() => {
    if (!saleId) return
    loadData()
  }, [saleId])

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    try {
      const [saleRes, categoriesRes, returnsRes] = await Promise.all([
        salesAPI.getSale(saleId),
        returnsAPI.getDamageCategories().catch(() => ({ success: true, data: [] })),
        returnsAPI.getSaleReturns(saleId).catch(() => ({ success: true, data: [] }))
      ])
      if (!saleRes?.success || !saleRes?.data) {
        setLoadError(true)
        return
      }
      setSale(saleRes.data)
      const cats = Array.isArray(categoriesRes?.data) ? categoriesRes.data : []
      setDamageCategories(cats)
      if (cats.length && !reasonCategoryId) setReasonCategoryId(cats[0]?.id ?? null)

      const returnsList = Array.isArray(returnsRes?.data) ? returnsRes.data : []
      setExistingReturns(returnsList)

      const alreadyReturnedBySaleItemId = {}
      returnsList.forEach(r => {
        (r.items || r.Items || []).forEach(item => {
          const sid = item.saleItemId ?? item.SaleItemId
          const qty = Number(item.qtyReturned ?? item.QtyReturned ?? 0)
          if (sid) alreadyReturnedBySaleItemId[sid] = (alreadyReturnedBySaleItemId[sid] || 0) + qty
        })
      })

      const saleItems = saleRes.data.items || saleRes.data.Items || []
      setLines(saleItems.map(si => {
        const soldQty = Number(si.qty ?? si.Qty ?? 0)
        const alreadyReturned = alreadyReturnedBySaleItemId[si.id] || 0
        const maxReturn = Math.max(0, soldQty - alreadyReturned)
        return {
          saleItemId: si.id,
          productName: (si.product?.nameEn ?? si.product?.NameEn ?? si.productName) || (si.product?.nameAr ?? si.product?.NameAr) || 'Product',
          soldQty,
          alreadyReturned,
          maxReturnable: maxReturn,
          returnQty: maxReturn > 0 ? '' : 0,
          condition: 'resellable',
          unitPrice: Number(si.unitPrice ?? si.UnitPrice ?? 0),
          unitType: si.unitType ?? si.UnitType ?? ''
        }
      }))

    } catch (e) {
      console.error('Error loading return invoice:', e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const updateLine = (index, field, value) => {
    setLines(prev => {
      const next = [...prev]
      const line = { ...next[index], [field]: value }
      if (field === 'returnQty') {
        const num = value === '' ? 0 : Number(value)
        const qty = Math.min(Math.max(0, num), line.maxReturnable)
        line.returnQty = line.maxReturnable === 0 ? 0 : (value === '' ? '' : qty)
        line.returnQtyNum = line.maxReturnable === 0 ? 0 : (Number.isFinite(num) ? Math.min(Math.max(0, num), line.maxReturnable) : 0)
      }
      if (field === 'condition') line.condition = value
      next[index] = line
      return next
    })
  }

  const subtotal = lines.reduce((sum, l) => {
    const q = typeof l.returnQty === 'number' ? l.returnQty : (l.returnQty === '' ? 0 : Number(l.returnQty) || 0)
    return sum + q * l.unitPrice
  }, 0)
  const vatRate = 0.05
  const vatTotal = Math.round(subtotal * vatRate * 100) / 100
  const grandTotal = subtotal + vatTotal
  const hasLines = lines.some(l => {
    const q = typeof l.returnQty === 'number' ? l.returnQty : (l.returnQty === '' ? 0 : Number(l.returnQty) || 0)
    return q > 0
  })

  const buildPayload = (createCreditNote = false) => {
    const items = lines
      .map(l => {
        const q = typeof l.returnQty === 'number' ? l.returnQty : (l.returnQty === '' ? 0 : Number(l.returnQty) || 0)
        return q > 0 ? { saleItemId: l.saleItemId, qty: q, condition: l.condition, damageCategoryId: reasonCategoryId || undefined } : null
      })
      .filter(Boolean)
    return {
      saleId: Number(saleId),
      reason: reason || (reasonCategoryId && damageCategories.find(d => d.id === reasonCategoryId)?.name) || undefined,
      items,
      createCreditNote: !!createCreditNote
    }
  }

  const handleSave = async (createCreditNote = false) => {
    if (!hasLines) {
      toast.error('Add at least one line with return quantity.')
      return
    }
    const payload = buildPayload(createCreditNote)
    if (!payload.items.length) {
      toast.error('Add at least one line with return quantity.')
      return
    }
    setSaving(true)
    try {
      const res = await returnsAPI.createSaleReturn(payload)
      const body = res?.data ?? res
      const success = body?.success !== false
      const created = body?.data ?? body
      if (!success) {
        toast.error('Could not save this return.')
        return
      }
      toast.success('Return saved successfully.')
      window.dispatchEvent(new CustomEvent('dataUpdated'))
      if (createCreditNote && created?.id) {
        try {
          const blob = await returnsAPI.getReturnBillPdf(created.id)
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 100)
        } catch {
          toast.success('Return saved. Open Reports → Returns to print credit note.')
        }
      }
      navigate(returnTo || '/reports?tab=returns')
    } catch (e) {
      console.error('Error saving return:', e)
      toast.error('Could not save this return.')
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => (returnTo ? navigate(returnTo) : navigate(-1))

  if (!saleId) {
    return (
      <div className="p-4">
        <p className="text-sm text-neutral-800">Open a return from an invoice.</p>
        <button type="button" className="mt-3 min-h-11 text-sm text-primary-700" onClick={goBack}>Back</button>
      </div>
    )
  }

  if (loading) {
    return <p className="p-4 text-sm text-neutral-500">Loading return…</p>
  }

  if (loadError || !sale) {
    return (
      <div className="p-4">
        <p className="text-sm text-neutral-800">Unable to load this invoice.</p>
        <button type="button" className="mt-3 min-h-11 text-sm text-primary-700" onClick={() => loadData()}>Retry</button>
        <button type="button" className="mt-3 ml-4 min-h-11 text-sm text-neutral-700" onClick={goBack}>Back</button>
      </div>
    )
  }

  const invoiceNo = sale.invoiceNo ?? sale.invoiceNumber ?? sale.id
  const customerName = sale.customerName ?? sale.customer?.name ?? '—'

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {returnTo?.startsWith('/ledger') ? 'Back to Customer Ledger' : 'Back'}
        </button>
        <h1 className="text-xl font-semibold text-neutral-900">Create Sales Return</h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Original Invoice</label>
            <p className="mt-0.5 text-neutral-900 font-medium">{invoiceNo}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Customer</label>
            <p className="mt-0.5 text-neutral-900">{customerName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Return Date</label>
            <p className="mt-0.5 text-neutral-900 tabular-nums">{new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Reason</label>
            <select
              value={reasonCategoryId ?? ''}
              onChange={e => {
                const id = e.target.value ? Number(e.target.value) : null
                setReasonCategoryId(id)
                const cat = damageCategories.find(c => c.id === id)
                if (cat) setReason(cat.name)
              }}
              className="mt-1 block w-full min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm"
            >
              <option value="">— Select —</option>
              {damageCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Sold Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Return Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Condition</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {lines.map((line, idx) => {
                const q = typeof line.returnQty === 'number' ? line.returnQty : (line.returnQty === '' ? 0 : Number(line.returnQty) || 0)
                const lineTotal = q * line.unitPrice
                return (
                  <tr key={line.saleItemId} className="bg-white">
                    <td className="px-4 py-2 text-sm text-neutral-900">{line.productName}</td>
                    <td className="px-4 py-2 text-sm text-right text-neutral-600">{line.soldQty} {line.unitType}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        max={line.maxReturnable}
                        value={line.returnQty}
                        onChange={e => updateLine(idx, 'returnQty', e.target.value)}
                        className="w-24 min-h-[44px] rounded-md border border-neutral-300 px-2 text-sm text-right tabular-nums"
                      />
                      {line.alreadyReturned > 0 && (
                        <span className="ml-1 text-xs text-warning">(max {line.maxReturnable})</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={line.condition}
                        onChange={e => updateLine(idx, 'condition', e.target.value)}
                        className="min-h-[44px] rounded-md border border-neutral-300 px-2 text-sm"
                      >
                        {CONDITION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-neutral-600 tabular-nums">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium tabular-nums">{formatCurrency(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <div className="text-sm space-y-1 text-right tabular-nums">
            <p>Subtotal: {formatCurrency(subtotal)}</p>
            <p>VAT (5%): {formatCurrency(vatTotal)}</p>
            <p className="font-semibold">Grand Total: {formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <div className="px-4 py-4 border-t border-neutral-200 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!hasLines || saving}
            className="inline-flex min-h-11 items-center gap-2 px-4 rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Return'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={!hasLines || saving}
            className="inline-flex min-h-11 items-center gap-2 px-4 rounded-md border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            Save & Print Credit Note
          </button>
        </div>
      </div>
    </div>
  )
}
