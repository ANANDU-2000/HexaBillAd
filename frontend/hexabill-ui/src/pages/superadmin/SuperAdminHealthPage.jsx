import { useState, useEffect } from 'react'
import {
  Database,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Server,
  Hash,
  Building2
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const SuperAdminHealthPage = () => {
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  const [migrating, setMigrating] = useState(false)
  const [showMigrateModal, setShowMigrateModal] = useState(false)

  const fetchHealth = async () => {
    try {
      setError(null)
      const data = await superAdminAPI.getPlatformHealth()
      setHealth(data)
      if (data && !data.success) {
        toast.error('Platform health check reported issues')
      }
    } catch (err) {
      console.error('Health check error:', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to load platform health')
      setHealth(null)
      toast.error('Failed to load platform health')
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  const handleCheckAgain = () => {
    setChecking(true)
    fetchHealth()
  }

  const handleRunMigrations = async () => {
    try {
      setMigrating(true)
      const res = await superAdminAPI.applyMigrations()
      const msg = res?.message || 'Migrations applied'
      toast.success(msg)
      setShowMigrateModal(false)
      fetchHealth()
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to apply migrations'
      toast.error(errMsg)
    } finally {
      setMigrating(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
        <LoadingCard />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Platform Health</h1>
          <p className="text-neutral-500 mt-1">Database, migrations, and platform status</p>
        </div>
        <button
          onClick={handleCheckAgain}
          disabled={checking}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-sm hover:shadow-md transition-all space-x-2 disabled:opacity-60"
        >
          <RefreshCw className={`h-5 w-5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking…' : 'Check again'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {health && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Database */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Database</h2>
            </div>
            {health.database?.connected ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-red-700">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Not connected</p>
                  {health.database?.error && (
                    <p className="text-sm mt-1 text-red-600">{health.database.error}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Migrations */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-purple-100">
                <Hash className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Migrations</h2>
            </div>
            <p className="text-sm text-neutral-600 mb-1">Last applied</p>
            <p className="font-mono text-sm bg-neutral-100 px-2 py-1 rounded mb-3 truncate" title={health.migrations?.lastApplied || '—'}>
              {health.migrations?.lastApplied || '—'}
            </p>
            {health.migrations?.pending?.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Pending migrations</p>
                    <ul className="text-sm mt-1 list-disc list-inside">
                      {health.migrations.pending.map((m, i) => (
                        <li key={i} className="font-mono">{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMigrateModal(true)}
                  className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-all"
                >
                  Run migrations
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">No pending migrations</span>
              </div>
            )}
          </div>

          {/* Company count */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-green-100">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Companies</h2>
            </div>
            <p className="text-3xl font-bold text-neutral-900">{health.companyCount ?? '—'}</p>
            <p className="text-sm text-neutral-500 mt-1">Total registered on platform</p>
          </div>

          {/* Timestamp */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-neutral-100">
                <Server className="h-6 w-6 text-neutral-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Last check</h2>
            </div>
            <p className="text-sm text-neutral-600">
              {health.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Run migrations confirmation modal */}
      {showMigrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Apply pending migrations?</h3>
            <p className="text-neutral-600 text-sm mb-4">
              {health?.migrations?.pending?.length ?? 0} migration(s) will be applied. This may take a moment. Do not close the app.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowMigrateModal(false)}
                disabled={migrating}
                className="px-4 py-2 text-neutral-700 font-medium rounded-xl hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunMigrations}
                disabled={migrating}
                className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-60 transition-all"
              >
                {migrating ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminHealthPage

