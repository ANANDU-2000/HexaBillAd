import { useState, useEffect } from 'react'
import {
  Building2,
  CheckCircle,
  Ban,
  DollarSign,
  Users,
  Database,
  Activity
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

/**
 * Platform overview – 6 metrics only (enterprise structure).
 * Total Companies, Active Companies, Suspended Companies, Monthly Revenue, Total Active Users, Total DB Storage Used.
 */
const SuperAdminDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const response = await superAdminAPI.getPlatformDashboard()
      if (response.success) {
        setDashboard(response.data)
      } else {
        toast.error(response.message || 'Failed to load dashboard')
      }
    } catch (error) {
      console.error('Dashboard error:', error)
      toast.error('Failed to load platform dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6">
        <LoadingCard />
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <p className="text-neutral-800 font-medium">Failed to load dashboard data</p>
          </div>
        </div>
      </div>
    )
  }

  const metrics = [
    {
      title: 'Total Companies',
      value: dashboard.totalTenants,
      icon: Building2,
      desc: 'All companies on platform'
    },
    {
      title: 'Active Companies',
      value: dashboard.activeTenants,
      icon: CheckCircle,
      desc: `Paid active · ${dashboard.trialTenants} on trial`
    },
    {
      title: 'Suspended Companies',
      value: dashboard.suspendedTenants + (dashboard.expiredTenants || 0),
      icon: Ban,
      desc: 'Suspended + expired'
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(dashboard.platformRevenue ?? dashboard.mrr ?? 0),
      icon: DollarSign,
      desc: 'Platform revenue'
    },
    {
      title: 'Total Active Users',
      value: dashboard.totalUsers,
      icon: Users,
      desc: 'Across all companies'
    },
    {
      title: 'Total DB Storage Used',
      value: `${dashboard.estimatedStorageUsedMb ?? 0} MB`,
      icon: Database,
      desc: 'Estimated (row-based)'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Platform overview</h1>
            <p className="text-neutral-600 text-sm mt-1">Key metrics at a glance</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Activity className="h-4 w-4" />
            <span>Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.title}
                className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500">{m.title}</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">{m.value}</p>
                    {m.desc && (
                      <p className="text-xs text-neutral-400 mt-2">{m.desc}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminDashboard
