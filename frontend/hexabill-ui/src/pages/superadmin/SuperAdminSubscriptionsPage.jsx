import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  Building2,
  Eye,
  Filter,
  Download,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import toast from 'react-hot-toast'

const SuperAdminSubscriptionsPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [mrrTotal, setMrrTotal] = useState(0)

  useEffect(() => {
    fetchTenants()
  }, [page, search, statusFilter])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const params = {
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined
      }
      const response = await superAdminAPI.getTenants(params)
      if (response.success) {
        const items = response.data?.items || []
        setTenants(items)
        setTotalCount(response.data?.totalCount || 0)
        const mrr = (response.data?.items || []).reduce((sum, t) => {
          // Prefer t.mrr from backend (tenant list DTO); fallback to subscription.plan
          if (t.mrr != null && Number(t.mrr) > 0) return sum + Number(t.mrr)
          const sub = t.subscription
          if (sub?.plan?.monthlyPrice && (sub?.status === 'Active' || sub?.status === 'Trial')) {
            return sum + Number(sub.plan.monthlyPrice || 0)
          }
          return sum
        }, 0)
        setMrrTotal(mrr)
      } else {
        toast.error(response.message || 'Failed to load subscriptions')
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status, trialEndDate) => {
    const s = (status || '').toLowerCase()
    const expiring = trialEndDate && new Date(trialEndDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    if (expiring && s === 'trial') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Trial (Expiring)</span>
    }
    const map = {
      active: 'bg-green-100 text-green-800',
      trial: 'bg-blue-100 text-blue-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-red-100 text-red-800'
    }
    const cls = map[s] || 'bg-gray-100 text-gray-800'
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${cls}`}>{status || '—'}</span>
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (loading && tenants.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6">
        <LoadingCard />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-primary-600" />
              Subscriptions
            </h1>
            <p className="text-neutral-600 text-sm mt-1">Platform-wide subscription view by company</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const headers = ['Company', 'Plan', 'Status', 'Trial End', 'MRR']
                const rows = tenants.map(t => [
                  t.name || '',
                  t.planName || '',
                  t.status || '',
                  t.trialEndDate ? new Date(t.trialEndDate).toLocaleDateString() : '',
                  Number(t.mrr || 0).toFixed(2)
                ])
                const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`
                a.click()
                URL.revokeObjectURL(url)
                toast.success('CSV exported')
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => fetchTenants()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-white rounded-xl border border-neutral-200">
          <h3 className="text-sm font-medium text-neutral-500 mb-1">Platform MRR (from active subscriptions)</h3>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(mrrTotal)}</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search company..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-48"
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Trial', label: 'Trial' },
              { value: 'Suspended', label: 'Suspended' },
              { value: 'Expired', label: 'Expired' }
            ]}
            className="w-40"
          />
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Trial End</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">MRR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                      No companies found
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const mrr = Number(t.mrr || 0)
                    return (
                      <tr key={t.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-neutral-900">{t.name || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{t.planName || '—'}</td>
                        <td className="px-4 py-3">{getStatusBadge(t.status || t.subscription?.status, t.trialEndDate)}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          {t.trialEndDate ? new Date(t.trialEndDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(mrr)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Page {page} of {totalPages} · {totalCount} total
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminSubscriptionsPage
