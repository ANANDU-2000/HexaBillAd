import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Download, FileText, DollarSign, TrendingUp, TrendingDown, Receipt, CreditCard, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isOwner } from '../../utils/roles'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { LoadingCard } from '../../components/Loading'
import { Input } from '../../components/Form'
import { reportsAPI } from '../../services'
import { toYYYYMMDD } from '../../utils/dateFormat'

const PRESETS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' }
]

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

const WorksheetPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [preset, setPreset] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  if (!user) return null
  if (!isOwner(user)) {
    navigate('/dashboard', { replace: true })
    return null
  }

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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
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
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              <span className="text-gray-500">to</span>
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

      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
        <Calendar className="h-4 w-4" />
        Period: {periodLabel}
      </p>

      {loading && <LoadingCard message="Loading worksheet…" />}

      {!loading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Total Sales</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.totalSales)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <TrendingDown className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium">Total Purchases</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.totalPurchases)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Receipt className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium">Total Expenses</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.totalExpenses)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium">Total Received</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.totalReceived)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium">Pending Amount</span>
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.pendingAmount)}</p>
          </div>
        </div>
      )}

      {!loading && !data && effectiveRange && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          No data for the selected period.
        </div>
      )}

      {!loading && !effectiveRange && preset === 'custom' && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          Select From and To dates for a custom range.
        </div>
      )}
    </div>
  )
}

export default WorksheetPage
