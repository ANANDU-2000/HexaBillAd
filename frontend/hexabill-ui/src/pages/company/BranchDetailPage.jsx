import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Building2, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { branchesAPI } from '../../services'

const BranchDetailPage = () => {
  const { id } = useParams()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        setLoading(true)
        const res = await branchesAPI.getBranchSummary(id, fromDate, toDate)
        if (res?.success && res?.data) setSummary(res.data)
        else setSummary(null)
      } catch (e) {
        toast.error(e?.message || 'Failed to load branch summary')
        setSummary(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, fromDate, toDate])

  if (loading && !summary) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Branch not found.</p>
        <Link to="/branches" className="text-primary-600 hover:underline mt-2 inline-block">Back to Branches</Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/branches" className="inline-flex items-center gap-1 text-primary-600 hover:underline mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Branches
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-50">
          <Building2 className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{summary.branchName}</h1>
          <p className="text-sm text-neutral-500">Branch summary</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Total Sales</p>
          <p className="text-lg font-semibold text-neutral-900">{formatCurrency(summary.totalSales)}</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Total Expenses</p>
          <p className="text-lg font-semibold text-neutral-900">{formatCurrency(summary.totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Profit</p>
          <p className={`text-lg font-semibold ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(summary.profit)}
          </p>
        </div>
      </div>

      <p className="text-sm text-neutral-500 mb-2">Date range: {fromDate} to {toDate}</p>
      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 text-sm"
        />
      </div>

      <h2 className="text-lg font-medium text-neutral-800 mb-3">Routes</h2>
      {summary.routes?.length === 0 ? (
        <p className="text-neutral-500">No routes in this branch.</p>
      ) : (
        <ul className="space-y-2">
          {summary.routes?.map((r) => (
            <li key={r.routeId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
              <span className="font-medium">{r.routeName}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-neutral-600">Sales: {formatCurrency(r.totalSales)}</span>
                <span className="text-neutral-600">Expenses: {formatCurrency(r.totalExpenses)}</span>
                <span className={r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  Profit: {formatCurrency(r.profit)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BranchDetailPage

