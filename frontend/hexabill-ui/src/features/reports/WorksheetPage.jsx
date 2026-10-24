import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Download, FileText, TrendingUp, TrendingDown, Receipt, CreditCard, AlertCircle, Wallet, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { isOwner } from '../../utils/roles'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { Input } from '../../components/Form'
import { reportsAPI } from '../../services/index'
import { toYYYYMMDD } from '../../utils/dateFormat'

const PRESETS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' }
]

const COLORS = {
  received: '#16A34A',
  pending: '#F59E0B',
  purchases: '#3B82F6',
  expenses: '#8B5CF6'
}

// Each card or slice id maps to the chart segments it highlights
const FOCUS_KEYS = {
  sales: ['received', 'pending'],
  received: ['received'],
  pending: ['pending'],
  purchases: ['purchases'],
  expenses: ['expenses']
}

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const percentOf = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null)

function getWeekBounds(now) {
  const d = new Date(now)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getMonthBounds(now) {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getYearBounds(now) {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), 0, 1)
  const end = new Date(d.getFullYear(), 11, 31)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getPresetRange(presetId) {
  const now = new Date()
  switch (presetId) {
    case 'week': {
      const w = getWeekBounds(now)
      return { fromDate: toYYYYMMDD(w.start), toDate: toYYYYMMDD(w.end) }
    }
    case 'month': {
      const m = getMonthBounds(now)
      return { fromDate: toYYYYMMDD(m.start), toDate: toYYYYMMDD(m.end) }
    }
    case 'year': {
      const y = getYearBounds(now)
      return { fromDate: toYYYYMMDD(y.start), toDate: toYYYYMMDD(y.end) }
    }
    default:
      return null
  }
}

function formatPeriodLabel(fromStr, toStr) {
  if (!fromStr || !toStr) return '—'
  const from = new Date(fromStr)
  const to = new Date(toStr)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return '—'
  return `${from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const SplitDonut = ({ title, subtitle, slices, centerLabel, centerValue, emptyText, activeKeys, onHover, onPin }) => {
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="text-sm text-neutral-500 mb-3">{subtitle}</p>
      {total > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div
            className="relative h-56"
            role="img"
            aria-label={`${title}: ${slices.map((s) => `${s.name} ${formatCurrency(s.value)}`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="none"
                  onMouseEnter={(_, index) => onHover(slices[index].key)}
                  onMouseLeave={() => onHover(null)}
                  onClick={(_, index) => onPin(slices[index].key)}
                >
                  {slices.map((s) => (
                    <Cell
                      key={s.key}
                      fill={s.color}
                      fillOpacity={!activeKeys || activeKeys.includes(s.key) ? 1 : 0.25}
                      style={{ cursor: 'pointer', transition: 'fill-opacity 200ms' }}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-neutral-500">{centerLabel}</span>
              <span className="text-lg font-semibold text-neutral-900">{centerValue}</span>
            </div>
          </div>
          <ul className="space-y-2">
            {slices.map((s) => {
              const share = percentOf(s.value, total)
              const isActive = !activeKeys || activeKeys.includes(s.key)
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onMouseEnter={() => onHover(s.key)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(s.key)}
                    onBlur={() => onHover(null)}
                    onClick={() => onPin(s.key)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-neutral-50 ${
                      isActive ? '' : 'opacity-40'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-neutral-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="tabular-nums text-neutral-900">
                      {formatCurrency(s.value)}
                      <span className="ml-2 text-neutral-500">{share ?? 0}%</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-neutral-500">{emptyText}</p>
      )}
    </div>
  )
}

const WorksheetPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [preset, setPreset] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [pinnedId, setPinnedId] = useState(null)

  const effectiveRange = preset === 'custom'
    ? (fromDate && toDate ? { fromDate: toYYYYMMDD(fromDate), toDate: toYYYYMMDD(toDate) } : null)
    : getPresetRange(preset)

  const fetchData = useCallback(async () => {
    if (!effectiveRange?.fromDate || !effectiveRange?.toDate) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await reportsAPI.getWorksheetReport(effectiveRange)
      const payload = res?.data ?? res
      setData(payload ?? null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load worksheet')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [effectiveRange?.fromDate, effectiveRange?.toDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (user && !isOwner(user)) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  if (!user || !isOwner(user)) return null

  const handleExportPdf = async () => {
    if (!effectiveRange?.fromDate || !effectiveRange?.toDate) {
      toast.error('Select a date range first')
      return
    }
    setExporting(true)
    try {
      const res = await reportsAPI.exportWorksheetPdf(effectiveRange)
      const blob = res?.data ?? res
      if (!(blob instanceof Blob)) {
        toast.error('Invalid export response')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `worksheet_${effectiveRange.fromDate}_${effectiveRange.toDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  const periodLabel = effectiveRange ? formatPeriodLabel(effectiveRange.fromDate, effectiveRange.toDate) : '—'

  const sales = toNumber(data?.totalSales)
  const purchases = toNumber(data?.totalPurchases)
  const expenses = toNumber(data?.totalExpenses)
  const received = toNumber(data?.totalReceived)
  const pending = toNumber(data?.pendingAmount)
  const outflow = purchases + expenses
  const net = received - outflow

  // Hover wins over a pinned selection so the chart previews on hover
  const activeId = hoverId ?? pinnedId
  const activeKeys = activeId ? FOCUS_KEYS[activeId] : null
  const togglePin = (id) => setPinnedId((current) => (current === id ? null : id))

  const kpis = [
    { id: 'sales', label: 'Total Sales', value: sales, icon: TrendingUp, iconClass: 'text-success' },
    { id: 'purchases', label: 'Total Purchases', value: purchases, icon: TrendingDown, iconClass: 'text-warning' },
    { id: 'expenses', label: 'Total Expenses', value: expenses, icon: Receipt, iconClass: 'text-neutral-600' },
    { id: 'received', label: 'Total Received', value: received, icon: CreditCard, iconClass: 'text-primary-600' },
    { id: 'pending', label: 'Pending Amount', value: pending, icon: AlertCircle, iconClass: 'text-warning' }
  ]

  const salesSlices = [
    { key: 'received', name: 'Received', value: received, color: COLORS.received },
    { key: 'pending', name: 'Pending', value: pending, color: COLORS.pending }
  ]
  const outflowSlices = [
    { key: 'purchases', name: 'Purchases', value: purchases, color: COLORS.purchases },
    { key: 'expenses', name: 'Expenses', value: expenses, color: COLORS.expenses }
  ]

  const flowMax = Math.max(received, outflow, 1)
  const flowRows = [
    { id: 'received', label: 'Money in · Received', value: received, color: COLORS.received },
    { id: 'purchases', label: 'Money out · Purchases', value: purchases, color: COLORS.purchases },
    { id: 'expenses', label: 'Money out · Expenses', value: expenses, color: COLORS.expenses }
  ]

  const collectedPct = percentOf(received, sales)
  const outstandingPct = percentOf(pending, sales)
  const spendPct = percentOf(outflow, received)

  const insights = [
    {
      label: 'Collected',
      value: collectedPct === null ? '—' : `${collectedPct}%`,
      hint: 'of sales received this period'
    },
    {
      label: 'Outstanding',
      value: outstandingPct === null ? '—' : `${outstandingPct}%`,
      hint: 'of sales still to collect'
    },
    {
      label: 'Spend vs collections',
      value: spendPct === null ? '—' : `${spendPct}%`,
      hint: spendPct === null ? 'No collections yet' : 'purchases + expenses vs received'
    },
    {
      label: 'Net position',
      value: formatCurrency(net),
      hint: net >= 0 ? 'Collections cover purchases and expenses' : 'Purchases and expenses exceed collections',
      tone: net >= 0 ? 'text-success' : 'text-error'
    }
  ]

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary-600" />
          Worksheet
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-36"
              />
              <span className="text-neutral-500">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-36"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!effectiveRange || exporting || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <p className="text-sm text-neutral-500 mb-3 flex items-center gap-1">
        <Calendar className="h-4 w-4" />
        Period: {periodLabel}
      </p>

      {loading && <LoadingCard message="Loading worksheet…" />}

      {!loading && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((k) => {
              const Icon = k.icon
              const isPinned = pinnedId === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={isPinned}
                  onMouseEnter={() => setHoverId(k.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(k.id)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => togglePin(k.id)}
                  className={`text-left bg-white rounded-lg border p-4 shadow-sm transition-all hover:shadow-md ${
                    isPinned ? 'border-primary-600 ring-2 ring-primary-200' : 'border-neutral-200'
                  } ${k.id === 'pending' ? 'col-span-2 md:col-span-1' : ''}`}
                >
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <Icon className={`h-5 w-5 ${k.iconClass}`} />
                    <span className="text-sm font-medium">{k.label}</span>
                  </div>
                  <p className="text-xl font-semibold text-neutral-900">{formatCurrency(k.value)}</p>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {insights.map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-neutral-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.label}</p>
                <p className={`mt-1 text-lg font-semibold ${item.tone || 'text-neutral-900'}`}>{item.value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{item.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SplitDonut
              title="Sales collection"
              subtitle="How this period's sales split between received and pending"
              slices={salesSlices}
              centerLabel="Sales"
              centerValue={formatCurrency(sales)}
              emptyText="No sales in this period."
              activeKeys={activeKeys}
              onHover={setHoverId}
              onPin={togglePin}
            />
            <SplitDonut
              title="Money out"
              subtitle="Where purchases and expenses went"
              slices={outflowSlices}
              centerLabel="Total out"
              centerValue={formatCurrency(outflow)}
              emptyText="No purchases or expenses in this period."
              activeKeys={activeKeys}
              onHover={setHoverId}
              onPin={togglePin}
            />
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary-600" />
                  Cash flow
                </h2>
                <p className="text-sm text-neutral-500">Bars are scaled to the larger of money in or money out</p>
              </div>
            </div>
            <div className="space-y-3">
              {flowRows.map((row) => {
                const width = Math.max(0, (row.value / flowMax) * 100)
                const isActive = !activeKeys || activeKeys.includes(row.id)
                return (
                  <button
                    key={row.id}
                    type="button"
                    onMouseEnter={() => setHoverId(row.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => togglePin(row.id)}
                    className={`w-full text-left transition-opacity ${isActive ? '' : 'opacity-40'}`}
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-700">{row.label}</span>
                      <span className="tabular-nums text-neutral-900">{formatCurrency(row.value)}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </button>
                )
              })}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200 text-sm">
                <span className="flex items-center gap-2 text-neutral-700">
                  Received <ArrowRight className="h-3.5 w-3.5 text-neutral-400" /> Purchases + Expenses
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400" /> Net
                </span>
                <span className={`font-semibold tabular-nums ${net >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(net)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !data && effectiveRange && (
        <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6 text-center text-neutral-500">
          No data for the selected period.
        </div>
      )}

      {!loading && !effectiveRange && preset === 'custom' && (
        <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6 text-center text-neutral-500">
          Select From and To dates for a custom range.
        </div>
      )}
    </div>
  )
}

export default WorksheetPage
