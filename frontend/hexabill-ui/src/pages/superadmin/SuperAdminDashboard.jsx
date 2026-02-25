import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckCircle,
  Ban,
  DollarSign,
  Users,
  Database,
  Activity,
  AlertTriangle,
  ChevronRight,
  Wallet,
  Zap,
  TrendingUp,
  ClipboardCheck,
  XCircle,
  Server,
  Link2
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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [revenueReport, setRevenueReport] = useState(null)
  const [tenantActivity, setTenantActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [extendingTrialId, setExtendingTrialId] = useState(null)
  const [onboardingReport, setOnboardingReport] = useState(null)
  const [onboardingIncompleteOnly, setOnboardingIncompleteOnly] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [platformHealth, setPlatformHealth] = useState(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  useEffect(() => {
    superAdminAPI.getPlatformHealth()
      .then((data) => setPlatformHealth(data))
      .catch(() => setPlatformHealth(null))
  }, [])

  useEffect(() => {
    if (!dashboard) return
    superAdminAPI.getRevenueReport()
      .then((res) => { if (res?.success && res?.data) setRevenueReport(res.data) })
      .catch(() => setRevenueReport(null))
  }, [dashboard])

  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        setOnboardingLoading(true)
        const res = await superAdminAPI.getOnboardingReport(onboardingIncompleteOnly)
        if (res?.success && res?.data) setOnboardingReport(res.data)
      } catch {
        setOnboardingReport(null)
      } finally {
        setOnboardingLoading(false)
      }
    }
    fetchOnboarding()
  }, [onboardingIncompleteOnly])

  useEffect(() => {
    let interval
    const fetchActivity = async () => {
      try {
        setActivityLoading(true)
        const res = await superAdminAPI.getTenantActivity()
        if (res?.success && Array.isArray(res?.data)) setTenantActivity(res.data)
      } catch {
        setTenantActivity([])
      } finally {
        setActivityLoading(false)
      }
    }
    fetchActivity()
    interval = setInterval(fetchActivity, 60000)
    return () => clearInterval(interval)
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
      if (!error?._handledByInterceptor) toast.error('Failed to load platform dashboard')
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
      desc: `${(dashboard.totalTenants > 0 && Number.isFinite(Number(dashboard.activeTenants)))
        ? ((Number(dashboard.activeTenants) / dashboard.totalTenants) * 100).toFixed(0)
        : 0}% Active · ${dashboard.trialTenants ?? 0} on trial`
    },
    {
      title: 'Suspended Companies',
      value: dashboard.suspendedTenants + (dashboard.expiredTenants || 0),
      icon: Ban,
      desc: 'Suspended + expired'
    },
    {
      title: 'Total Tenant Sales',
      value: formatCurrency(Number(dashboard?.platformRevenue) || 0),
      icon: DollarSign,
      desc: 'All companies\' sales combined (not platform earnings)'
    },
    {
      title: 'Platform MRR',
      value: dashboard?.hasSubscriptionData === false ? 'No subscription data' : formatCurrency(Number(dashboard?.mrr) || 0),
      icon: Wallet,
      desc: dashboard?.hasSubscriptionData === false ? 'Subscriptions table has no plans yet' : 'Subscription revenue from active plans'
    },
    {
      title: 'Total Active Users',
      value: (dashboard?.totalUsers || 0).toLocaleString(),
      icon: Users,
      desc: 'Across all companies'
    },
    {
      title: dashboard?.isRealDatabaseSize ? 'Total DB Storage Used' : 'Estimated DB Storage',
      value: `${(dashboard?.estimatedStorageUsedMb ?? 0).toFixed(0)} MB`,
      icon: Database,
      desc: dashboard?.isRealDatabaseSize
        ? 'PostgreSQL database size (pg_database_size)'
        : (dashboard?.storageFormulaDescription || 'Row-based estimate')
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

        {/* Platform & connection – Backend URL + DB status (from platform-health) */}
        <div className="mb-6 p-4 bg-white border border-neutral-200 rounded-xl">
          <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-3">
            <Server className="h-5 w-5 text-indigo-600" />
            Platform & connection
          </h3>
          {platformHealth == null ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-500 mb-1">Backend API</p>
                <a
                  href={platformHealth.backendUrl ? `${platformHealth.backendUrl}/api/health` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-indigo-600 hover:underline font-mono"
                >
                  <Link2 className="h-4 w-4" />
                  {platformHealth.backendUrl || '—'}
                </a>
              </div>
              <div>
                <p className="text-neutral-500 mb-1">Database</p>
                <span className={`flex items-center gap-1.5 ${platformHealth.database?.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {platformHealth.database?.connected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {platformHealth.database?.connected ? 'Connected' : (platformHealth.database?.error || 'Disconnected')}
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/superadmin/health')}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            Infrastructure & health →
          </button>
          {/* Resource usage: know when you're hitting plan limits (memory, DB connections) */}
          {platformHealth?.resourceUsage && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <h4 className="font-medium text-neutral-700 mb-2">Resource usage (backend)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-neutral-500">Memory</p>
                  <p className="font-semibold">{platformHealth.resourceUsage.memoryUsedMb} MB / ~{platformHealth.resourceUsage.workingSetMb} MB</p>
                  <p className={`text-xs ${platformHealth.resourceUsage.limitsHint === 'critical' ? 'text-red-600' : platformHealth.resourceUsage.limitsHint === 'warning' ? 'text-amber-600' : 'text-neutral-500'}`}>
                    {platformHealth.resourceUsage.memoryUsagePercent}% — {platformHealth.resourceUsage.limitsHint === 'critical' ? 'Critical' : platformHealth.resourceUsage.limitsHint === 'warning' ? 'Warning' : 'OK'}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500">DB connections</p>
                  <p className="font-semibold">{platformHealth.resourceUsage.activeConnections} / {platformHealth.resourceUsage.maxConnections}</p>
                  <p className={`text-xs ${platformHealth.resourceUsage.connectionPoolUsagePercent > 90 ? 'text-red-600' : platformHealth.resourceUsage.connectionPoolUsagePercent > 75 ? 'text-amber-600' : 'text-neutral-500'}`}>
                    {platformHealth.resourceUsage.connectionPoolUsagePercent}% pool
                  </p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                If memory or connections are often &gt;75%, consider upgrading the Render plan. For live CPU/RAM, check Render dashboard → your service → Metrics.
              </p>
            </div>
          )}
        </div>

        {/* Live Activity - Top tenants by API calls (last 60 min). In-memory; resets on server restart. */}
        <div className="mb-6 p-4 bg-white border border-neutral-200 rounded-xl">
          <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-amber-500" />
            Live Activity — Top 10 by API calls (last 60 min)
          </h3>
          <p className="text-xs text-neutral-500 mb-3">Activity resets on server restart.</p>
          {activityLoading && tenantActivity.length === 0 ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : tenantActivity.length === 0 ? (
            <p className="text-sm text-neutral-500">No tenant activity in the last hour</p>
          ) : (
            <ul className="space-y-2">
              {tenantActivity.map((t, idx) => (
                <li
                  key={t.tenantId}
                  className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                    t.isHighVolume
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-neutral-50 border-neutral-100 hover:bg-neutral-100'
                  }`}
                  onClick={() => navigate(`/superadmin/tenants/${t.tenantId}`)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-neutral-500 font-mono text-sm w-6">#{idx + 1}</span>
                    <span className="font-medium text-neutral-900">{t.tenantName}</span>
                    {t.isHighVolume && (
                      <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                        High volume
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-600">
                    {t.requestCount} req · last {new Date(t.lastActiveAt).toLocaleTimeString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {dashboard?.trialsExpiringThisWeek?.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" />
              Trials Expiring This Week ({dashboard.trialsExpiringThisWeek.length})
            </h3>
            <ul className="space-y-2">
              {dashboard.trialsExpiringThisWeek.slice(0, 10).map((t) => {
                const endDate = new Date(t.trialEndDate)
                const daysLeft = Math.ceil((endDate - new Date()) / (24 * 60 * 60 * 1000))
                return (
                  <li
                    key={t.tenantId}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100 hover:bg-amber-50"
                  >
                    <span
                      className="font-medium text-neutral-900 cursor-pointer flex-1"
                      onClick={() => navigate(`/superadmin/tenants/${t.tenantId}`)}
                    >
                      {t.name}
                    </span>
                    <span className="text-sm text-amber-700 mr-2">
                      {endDate.toLocaleDateString()} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </span>
                    <button
                      type="button"
                      disabled={extendingTrialId === t.tenantId}
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          setExtendingTrialId(t.tenantId)
                          const newEnd = new Date(endDate)
                          newEnd.setDate(newEnd.getDate() + 7)
                          const res = await superAdminAPI.updateTenant(t.tenantId, {
                            trialEndDate: newEnd.toISOString()
                          })
                          if (res?.success) {
                            toast.success(`Trial extended for ${t.name}`, { id: 'trial-extend' })
                            fetchDashboard()
                          } else {
                            toast.error(res?.message || 'Failed to extend trial', { id: 'trial-extend' })
                          }
                        } catch (err) {
                          if (!err?._handledByInterceptor) {
                            toast.error(err?.response?.data?.message || 'Failed to extend trial', { id: 'trial-extend' })
                          }
                        } finally {
                          setExtendingTrialId(null)
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {extendingTrialId === t.tenantId ? 'Extending…' : 'Extend 7 days'}
                    </button>
                    <ChevronRight
                      className="h-4 w-4 text-neutral-400 cursor-pointer ml-1"
                      onClick={() => navigate(`/superadmin/tenants/${t.tenantId}`)}
                    />
                  </li>
                )
              })}
            </ul>
            {dashboard.trialsExpiringThisWeek.length > 10 && (
              <p className="mt-2 text-sm text-amber-700">
                +{dashboard.trialsExpiringThisWeek.length - 10} more. View in{' '}
                <button
                  type="button"
                  onClick={() => navigate('/superadmin/tenants')}
                  className="underline font-medium"
                >
                  Companies
                </button>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.title}
                className="bg-white rounded-xl border border-neutral-200 p-6"
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

        {/* Platform revenue report: MRR trend, churn, new signups (#45) */}
        {revenueReport && (
          <div className="mt-8 p-4 sm:p-6 bg-white border border-neutral-200 rounded-xl">
            <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Platform revenue report
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500">Current MRR</p>
                <p className="text-lg font-bold text-neutral-900">{formatCurrency(Number(revenueReport.currentMrr) || 0)}</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500">Active subscriptions</p>
                <p className="text-lg font-bold text-neutral-900">{revenueReport.currentActiveSubscriptions ?? 0}</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500">Churned (30 days)</p>
                <p className="text-lg font-bold text-red-600">{revenueReport.churnedLast30Days ?? 0}</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <p className="text-xs text-neutral-500">Churn rate</p>
                <p className="text-lg font-bold text-neutral-900">{Number(revenueReport.churnRatePercent ?? 0).toFixed(1)}%</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 font-medium text-neutral-600">Month</th>
                    <th className="text-right py-2 font-medium text-neutral-600">MRR</th>
                    <th className="text-right py-2 font-medium text-neutral-600">New signups</th>
                  </tr>
                </thead>
                <tbody>
                  {(revenueReport.mrrByMonth || []).map((row) => (
                    <tr key={row.month} className="border-b border-neutral-100">
                      <td className="py-2 text-neutral-800">{row.month}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(Number(row.mrr) || 0)}</td>
                      <td className="text-right py-2">{row.newSignups ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tenant onboarding tracker: who completed setup, who stuck (#46) */}
        <div className="mt-8 p-4 sm:p-6 bg-white border border-neutral-200 rounded-xl">
          <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Tenant onboarding tracker
          </h3>
          <p className="text-sm text-neutral-500 mb-3">
            Steps: Company info → VAT → Add product → Add customer → Create invoice. Derived from tenant data.
          </p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={onboardingIncompleteOnly}
              onChange={(e) => setOnboardingIncompleteOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            <span className="text-sm text-neutral-700">Show incomplete only (stuck)</span>
          </label>
          {onboardingLoading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : onboardingReport ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-500">Total tenants</p>
                  <p className="text-lg font-bold text-neutral-900">{onboardingReport.totalTenants ?? 0}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-700">Complete (5/5)</p>
                  <p className="text-lg font-bold text-emerald-800">{onboardingReport.completeCount ?? 0}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-700">Incomplete</p>
                  <p className="text-lg font-bold text-amber-800">{onboardingReport.incompleteCount ?? 0}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-500">Showing</p>
                  <p className="text-lg font-bold text-neutral-900">{(onboardingReport.tenants || []).length}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-2 font-medium text-neutral-600">Tenant</th>
                      <th className="text-left py-2 font-medium text-neutral-600">Status</th>
                      <th className="text-center py-2 font-medium text-neutral-600" title="Company info">1</th>
                      <th className="text-center py-2 font-medium text-neutral-600" title="VAT">2</th>
                      <th className="text-center py-2 font-medium text-neutral-600" title="Product">3</th>
                      <th className="text-center py-2 font-medium text-neutral-600" title="Customer">4</th>
                      <th className="text-center py-2 font-medium text-neutral-600" title="Invoice">5</th>
                      <th className="text-right py-2 font-medium text-neutral-600">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(onboardingReport.tenants || []).map((row) => (
                      <tr
                        key={row.tenantId}
                        className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => navigate(`/superadmin/tenants/${row.tenantId}`)}
                      >
                        <td className="py-2 font-medium text-neutral-900">{row.tenantName}</td>
                        <td className="py-2 text-neutral-600">{row.status ?? '—'}</td>
                        <td className="py-2 text-center">
                          {row.step1CompanyInfo ? <CheckCircle className="h-4 w-4 text-emerald-600 inline" /> : <XCircle className="h-4 w-4 text-neutral-300 inline" />}
                        </td>
                        <td className="py-2 text-center">
                          {row.step2VatSetup ? <CheckCircle className="h-4 w-4 text-emerald-600 inline" /> : <XCircle className="h-4 w-4 text-neutral-300 inline" />}
                        </td>
                        <td className="py-2 text-center">
                          {row.step3HasProduct ? <CheckCircle className="h-4 w-4 text-emerald-600 inline" /> : <XCircle className="h-4 w-4 text-neutral-300 inline" />}
                        </td>
                        <td className="py-2 text-center">
                          {row.step4HasCustomer ? <CheckCircle className="h-4 w-4 text-emerald-600 inline" /> : <XCircle className="h-4 w-4 text-neutral-300 inline" />}
                        </td>
                        <td className="py-2 text-center">
                          {row.step5HasInvoice ? <CheckCircle className="h-4 w-4 text-emerald-600 inline" /> : <XCircle className="h-4 w-4 text-neutral-300 inline" />}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {row.completedSteps}/5 {row.isComplete && <span className="text-emerald-600">Done</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(onboardingReport.tenants || []).length === 0 && (
                <p className="text-sm text-neutral-500 py-4">
                  {onboardingIncompleteOnly ? 'No incomplete tenants.' : 'No tenants to show.'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">Could not load onboarding report.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminDashboard
