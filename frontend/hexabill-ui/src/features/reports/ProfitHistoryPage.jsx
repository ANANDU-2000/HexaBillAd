import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, RefreshCw, Download, Printer, FileText, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { profitAPI, salesAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { useConfirmDialog } from '../../hooks/useConfirmDialog'
import { LoadingCard } from '../../components/Loading'
import CountUp from '../../components/ui/CountUp'

/** UAE business date (Asia/Dubai, UTC+4, no DST) as YYYY-MM-DD, independent of the device time zone. */
const dubaiToday = () => new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10)
const shiftDays = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
const monthStart = (ymd) => `${ymd.slice(0, 7)}-01`
const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom Date' }
]

export function rangeForPreset(preset, today = dubaiToday()) {
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = shiftDays(today, -1); return { from: y, to: y } }
    case 'week': return { from: shiftDays(today, -6), to: today }
    case 'month': return { from: monthStart(today), to: today }
    case 'lastMonth': {
      const firstThis = monthStart(today)
      const lastEnd = shiftDays(firstThis, -1)
      return { from: monthStart(lastEnd), to: lastEnd }
    }
    default: return null
  }
}

const money = (v) => formatCurrency(Number(v) || 0)
const marginTone = (pct, hasWarning) => {
  if (pct >= 10 && !hasWarning) return 'bg-emerald-100 text-emerald-800'
  if (pct >= 3 && !hasWarning) return 'bg-warning-bg text-warning-fg'
  return 'bg-red-100 text-red-800'
}
const warningLabel = (inv) => {
  const r = inv.warningReason || ''
  if (r.startsWith('Missing')) return 'Missing Cost'
  if (inv.grossProfit < 0) return 'Loss'
  if (r.startsWith('Low')) return 'Low Margin'
  return null
}

function SummaryCard({ title, amount, valueClass = '', children }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-600">{title}</p>
      <p className={`mt-1 text-[20px] font-semibold tabular-nums leading-tight ${valueClass}`}><CountUp value={amount} format={money} /></p>
      <div className="mt-1 text-xs text-slate-600">{children}</div>
    </div>
  )
}

export default function ProfitHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [askConfirm, confirmDialog] = useConfirmDialog()
  const urlPreset = searchParams.get('preset')
  const preset = PRESETS.some((p) => p.id === urlPreset) ? urlPreset : (searchParams.get('from') ? 'custom' : 'today')
  const presetRange = preset !== 'custom' ? rangeForPreset(preset) : null
  const from = presetRange?.from || searchParams.get('from') || dubaiToday()
  const to = presetRange?.to || searchParams.get('to') || from

  const [search, setSearch] = useState('')
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await profitAPI.getBreakdown({ fromDate: from, toDate: to })
      if (res?.success) setData(res.data)
      else setError(res?.message || 'Could not load profit details.')
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load profit details.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const setPreset = (id) => {
    const next = new URLSearchParams()
    next.set('preset', id)
    if (id === 'custom') { next.set('from', from); next.set('to', to) }
    setSearchParams(next, { replace: true })
  }
  const setCustom = (key, value) => {
    const next = new URLSearchParams({ preset: 'custom', from, to })
    next.set(key, value)
    if (next.get('to') < next.get('from')) next.set(key === 'from' ? 'to' : 'from', value)
    setSearchParams(next, { replace: true })
  }

  const summary = data?.summary
  const invoices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.invoices || []).filter((i) =>
      (!issuesOnly || i.hasMarginWarning) &&
      (!q || i.invoiceNo.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q)))
  }, [data, search, issuesOnly])

  // Keep the list short: 20 invoices per page instead of an endless scroll.
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, issuesOnly, from, to])
  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const firstRow = invoices.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(safePage * PAGE_SIZE, invoices.length)
  const pageRows = invoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const syncCosts = async () => {
    const ok = await askConfirm({
      title: 'Sync latest purchase costs?',
      message: `This re-costs every bill from ${from} to ${to} using the latest purchase cost (VAT excluded) for each product. Invoice amounts do not change. Profit for this period may change, and the change is recorded in the audit log.`,
      confirmLabel: 'Sync costs'
    })
    if (!ok) return
    setSyncing(true)
    try {
      const res = await profitAPI.recalculateCosts(from, to)
      if (res?.success) {
        toast.success(res.message || 'Costs synced')
        await load()
      } else toast.error(res?.message || 'Could not sync costs')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error(e?.response?.data?.message || 'Could not sync costs')
    } finally {
      setSyncing(false)
    }
  }

  const openInvoicePdf = async (saleId) => {
    try {
      const blob = await salesAPI.getInvoicePdf(saleId, { layout: 'full' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Failed to open the invoice PDF')
    }
  }

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['Invoice', 'Date (UAE)', 'Customer', 'Product', 'Unit', 'Qty', 'Net sale excl VAT', 'Cost excl VAT', 'Profit', 'Margin %', 'Cost source']]
    invoices.forEach((inv) => {
      rows.push([inv.invoiceNo, inv.invoiceDateDubai, inv.customerName, '(invoice total)', '', '', inv.netSalesExclVat, inv.totalCost, inv.grossProfit, inv.marginPercent, inv.warningReason || ''])
      inv.items.forEach((it) => rows.push([inv.invoiceNo, inv.invoiceDateDubai, inv.customerName, it.productName, it.unit, it.qty, it.lineNetRevenue, it.lineTotalCost, it.lineProfit, it.lineMarginPercent, it.costSource]))
    })
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `profit-${from}_${to}.csv`
    a.click()
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }

  const pill = (active) => `h-9 px-3.5 text-sm font-bold rounded-lg border transition-colors ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`
  const btn = 'inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 p-3 sm:p-4 text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Profit &amp; Margin Inspector</h1>
          <p className="text-sm text-slate-600">See exact product costs, sales margins &amp; 5% profit VAT</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className={btn} onClick={syncCosts} disabled={syncing || loading}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden /> Sync Latest Purchase Costs
          </button>
          <button type="button" className={btn} onClick={exportCsv} disabled={!invoices.length}><Download className="h-4 w-4" aria-hidden /> Export CSV</button>
          <button type="button" className={btn} onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> PDF</button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPreset(p.id)} className={pill(preset === p.id)} aria-pressed={preset === p.id}>{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {preset === 'custom' && (
            <>
              <label className="text-xs font-bold text-slate-600">From
                <input type="date" value={from} max={to} onChange={(e) => e.target.value && setCustom('from', e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">To
                <input type="date" value={to} min={from} onChange={(e) => e.target.value && setCustom('to', e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm" />
              </label>
            </>
          )}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice # or customer..." aria-label="Search invoice number or customer"
            className="h-10 min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
          <div className="flex gap-2" role="group" aria-label="Bill filter">
            <button type="button" className={pill(!issuesOnly)} aria-pressed={!issuesOnly} onClick={() => setIssuesOnly(false)}>All Bills</button>
            <button type="button" className={pill(issuesOnly)} aria-pressed={issuesOnly} onClick={() => setIssuesOnly(true)}>Margin Issues Only ({summary?.anomalousMarginCount ?? 0})</button>
          </div>
        </div>
        <p className="text-xs text-slate-500">UAE business dates: {from === to ? from : `${from} to ${to}`}</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error} <button type="button" className="underline" onClick={load}>Try again</button></div>}
      {loading && !data ? <LoadingCard /> : null}

      {summary && (
        <>
          <div className="hb-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard title="Net sales (excl. VAT)" amount={summary.netSalesExclVat}>
              Gross: {money(summary.grossSalesInclVat)} · VAT Excl: {money(summary.outputVatExcluded)} · Disc: {money(summary.discountsAndRoundOff)}
              {summary.returnsExclVat > 0 && <> · Returns: {money(summary.returnsExclVat)}</>}
            </SummaryCard>
            <SummaryCard title="Product cost (COGS)" amount={summary.totalCogsExclVat}>Verified Purchase Cost Basis</SummaryCard>
            <SummaryCard title="Gross profit" amount={summary.grossProfit} valueClass={summary.grossProfit < 0 ? 'text-red-700' : 'text-emerald-700'}>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${summary.grossProfit < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{summary.grossMarginPercent}% Margin</span>
            </SummaryCard>
            <SummaryCard title="Net profit (after expenses)" amount={summary.netProfit} valueClass={summary.netProfit < 0 ? 'text-red-700' : 'text-slate-900'}>
              Expenses: {summary.totalExpenses > 0 ? '-' : ''}{money(summary.totalExpenses)} · 5% Profit VAT: {money(summary.vatOnNetProfit5Percent)}
            </SummaryCard>
          </div>
          {(data.notes || []).map((n) => (
            <p key={n} className="flex items-start gap-2 rounded-lg bg-warning-bg p-2 text-xs font-medium text-warning-fg"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{n}</p>
          ))}

          <div className="rounded-xl border border-slate-200 bg-white">
            <table className="w-full table-fixed border-collapse text-left text-[15px]">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-medium text-slate-600 md:top-16">
                <tr>
                  <th className="w-[28%] p-2">Invoice</th>
                  <th className="hidden p-2 lg:table-cell lg:w-[18%]">Customer</th>
                  <th className="p-2 text-right">Net Sale</th>
                  <th className="p-2 text-right">Cost</th>
                  <th className="p-2 text-right">Profit</th>
                  <th className="w-[20%] p-2 text-right sm:w-[16%]">Margin</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-600">{data.invoices.length ? 'No bills match this filter.' : 'No bills in this period.'}</td></tr>
                )}
                {pageRows.map((inv) => {
                  const open = expanded.has(inv.saleId)
                  const label = warningLabel(inv)
                  return (
                    <Fragment key={inv.saleId}>
                      <tr className="min-h-[56px] cursor-pointer border-t border-slate-200 hover:bg-slate-50" onClick={() => toggle(inv.saleId)}>
                        <td className="p-2">
                          <button type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} invoice ${inv.invoiceNo}`} className="flex min-h-11 w-full items-center gap-2 text-left" onClick={(e) => { e.stopPropagation(); toggle(inv.saleId) }}>
                            {open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                            <span className="min-w-0">
                              <span className="block truncate font-bold">{inv.invoiceNo}</span>
                              <span className="block truncate text-xs text-slate-600">{inv.invoiceDateDubai}<span className="lg:hidden"> · {inv.customerName}</span></span>
                            </span>
                          </button>
                        </td>
                        <td className="hidden truncate p-2 lg:table-cell" title={inv.customerName}>{inv.customerName}</td>
                        <td className="whitespace-nowrap p-2 text-right tabular-nums">{money(inv.netSalesExclVat)}</td>
                        <td className="whitespace-nowrap p-2 text-right tabular-nums">{money(inv.totalCost)}</td>
                        <td className={`whitespace-nowrap p-2 text-right font-bold tabular-nums ${inv.grossProfit > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{money(inv.grossProfit)}</td>
                        <td className="p-2 text-right">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${marginTone(inv.marginPercent, inv.hasMarginWarning)}`}>{inv.marginPercent}%</span>
                          {label && <span className="mt-0.5 block text-xs font-bold text-red-700">{label}</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-slate-200">
                          <td colSpan={6} className="p-0">
                            <div className="border-t border-slate-200 bg-slate-50 p-3">
                              {inv.warningReason && <p className="mb-2 text-sm font-bold text-red-700">{inv.warningReason}</p>}
                              <table className="w-full table-fixed text-left text-sm">
                                <thead className="text-xs font-medium text-slate-600">
                                  <tr>
                                    <th className="w-[30%] pb-1">Product</th>
                                    <th className="w-[12%] pb-1">Qty</th>
                                    <th className="pb-1 text-right">Sold At</th>
                                    <th className="pb-1 text-right">Purchase Cost</th>
                                    <th className="pb-1 text-right">Profit</th>
                                    <th className="w-[11%] pb-1 text-right">Margin</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.items.map((it, idx) => (
                                    <tr key={`${it.productId}-${idx}`} className="border-t border-slate-200 align-top">
                                      <td className="break-words py-2 pr-2 text-sm font-bold">{it.productName}</td>
                                      <td className="py-2 tabular-nums">{it.qty} {it.unit}</td>
                                      <td className="py-2 text-right tabular-nums">{money(it.lineNetRevenue)}</td>
                                      <td className="py-2 text-right tabular-nums">
                                        {money(it.lineTotalCost)}
                                        <span className={`mt-0.5 block text-xs font-semibold ${it.costDiffersFromLatestPurchase || it.costSource === 'Missing cost' ? 'text-red-700' : 'text-slate-500'}`}>{it.costSource}</span>
                                        {it.costDiffersFromLatestPurchase && it.latestPurchaseUnitCostExclVat != null && (
                                          <span className="block text-xs text-red-700">Latest purchase: {money(it.latestPurchaseUnitCostExclVat)} per {it.unit}</span>
                                        )}
                                      </td>
                                      <td className={`py-2 text-right font-bold tabular-nums ${it.lineProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{it.lineProfit >= 0 ? '+' : '-'}{money(Math.abs(it.lineProfit))}</td>
                                      <td className="py-2 text-right tabular-nums">{it.lineMarginPercent}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="mt-2 flex flex-wrap gap-2 print:hidden">
                                <button type="button" className={btn} onClick={() => openInvoicePdf(inv.saleId)}><FileText className="h-4 w-4" aria-hidden /> View / Print Invoice PDF</button>
                                {inv.items.some((i) => i.costDiffersFromLatestPurchase) && (
                                  <button type="button" className={btn} onClick={syncCosts} disabled={syncing}><RefreshCw className="h-4 w-4" aria-hidden /> Recalculate from Latest Purchase Cost</button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {invoices.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 print:hidden">
                <p className="text-sm text-slate-600 tabular-nums">
                  {firstRow}–{lastRow} of {invoices.length} invoices
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-sm font-medium tabular-nums text-slate-700">{safePage} / {pageCount}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={safePage >= pageCount}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  )
}
