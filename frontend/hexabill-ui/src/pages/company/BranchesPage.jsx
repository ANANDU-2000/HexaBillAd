import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, Plus, ChevronRight, MapPin, LayoutGrid } from 'lucide-react'
import toast from 'react-hot-toast'
import { branchesAPI, routesAPI } from '../../services'
import Modal from '../../components/Modal'
import { Input } from '../../components/Form'
import { isAdminOrOwner } from '../../utils/roles'

const BranchesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'routes' ? 'routes' : 'branches'
  const [activeTab, setActiveTab] = useState(initialTab)

  const [branches, setBranches] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filter state for routes
  const [routeBranchFilter, setRouteBranchFilter] = useState('')

  // Form states
  const [branchForm, setBranchForm] = useState({ name: '', address: '' })
  const [routeForm, setRouteForm] = useState({ name: '', branchId: '' })

  const canManage = isAdminOrOwner(JSON.parse(localStorage.getItem('user') || '{}'))

  useEffect(() => {
    // Update URL when tab changes
    setSearchParams({ tab: activeTab })
  }, [activeTab, setSearchParams])

  const fetchBranches = async () => {
    try {
      const res = await branchesAPI.getBranches()
      if (res?.success && res?.data) setBranches(res.data)
      else setBranches([])
    } catch (err) {
      console.error('Fetch branches error:', err)
      if (activeTab === 'branches') {
        toast.error(err.response?.data?.message || 'Failed to load branches')
      }
      setBranches([])
    }
  }

  const fetchRoutes = async () => {
    try {
      const branchId = routeBranchFilter ? parseInt(routeBranchFilter, 10) : null
      const res = await routesAPI.getRoutes(branchId)
      if (res?.success && res?.data) setRoutes(res.data)
      else setRoutes([])
    } catch (err) {
      console.error('Fetch routes error:', err)
      if (activeTab === 'routes') {
        toast.error(err.response?.data?.message || 'Failed to load routes')
      }
      setRoutes([])
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchBranches(), fetchRoutes()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Refetch routes when filter changes
  useEffect(() => {
    if (!loading) fetchRoutes()
  }, [routeBranchFilter])

  const handleCreateBranch = async (e) => {
    e?.preventDefault()
    if (!branchForm.name?.trim()) {
      toast.error('Branch name is required')
      return
    }
    try {
      setSaving(true)
      const res = await branchesAPI.createBranch({
        name: branchForm.name.trim(),
        address: branchForm.address?.trim() || undefined
      })
      if (res?.success) {
        toast.success('Branch created')
        setShowBranchModal(false)
        setBranchForm({ name: '', address: '' })
        fetchBranches()
      } else {
        toast.error(res?.message || 'Failed to create branch')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create branch')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRoute = async (e) => {
    e?.preventDefault()
    if (!routeForm.name?.trim()) {
      toast.error('Route name is required')
      return
    }
    const bid = routeForm.branchId ? parseInt(routeForm.branchId, 10) : null
    if (!bid) {
      toast.error('Please select a branch')
      return
    }
    try {
      setSaving(true)
      const res = await routesAPI.createRoute({ name: routeForm.name.trim(), branchId: bid })
      if (res?.success) {
        toast.success('Route created')
        setShowRouteModal(false)
        setRouteForm({ name: '', branchId: '' })
        // If current filter is different or empty, refresh to show new route (or stay same)
        fetchRoutes()
        // Also refresh branches to update counts if needed
        fetchBranches()
      } else {
        toast.error(res?.message || 'Failed to create route')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create route')
    } finally {
      setSaving(false)
    }
  }

  if (loading && branches.length === 0 && routes.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary-600" />
          Branches & Routes
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 mb-6">
        <button
          onClick={() => setActiveTab('branches')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'branches'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
        >
          <Building2 className="h-4 w-4" />
          Branches
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'routes'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
        >
          <MapPin className="h-4 w-4" />
          Routes
        </button>
      </div>

      {/* Tab Content: Branches */}
      {activeTab === 'branches' && (
        <div className="animate-fadeIn">
          <div className="flex justify-end mb-4">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowBranchModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Branch
              </button>
            )}
          </div>

          {branches.length === 0 ? (
            <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center text-neutral-500">
              No branches yet. {canManage && 'Add a branch to get started.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {branches.map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/branches/${b.id}`}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-neutral-200 hover:border-primary-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-50">
                        <Building2 className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{b.name}</p>
                        {b.address && <p className="text-sm text-neutral-500">{b.address}</p>}
                        <p className="text-xs text-neutral-400">{b.routeCount || 0} route(s)</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tab Content: Routes */}
      {activeTab === 'routes' && (
        <div className="animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-600">Filter by Branch:</span>
              <select
                value={routeBranchFilter}
                onChange={(e) => setRouteBranchFilter(e.target.value)}
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[150px]"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  // Pre-select the filtered branch if active
                  if (routeBranchFilter) setRouteForm(prev => ({ ...prev, branchId: routeBranchFilter }))
                  else if (branches.length > 0) setRouteForm(prev => ({ ...prev, branchId: branches[0].id }))
                  setShowRouteModal(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Route
              </button>
            )}
          </div>

          {routes.length === 0 ? (
            <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center text-neutral-500">
              No routes found. {canManage && branches.length > 0 && 'Add a route to get started.'}
              {canManage && branches.length === 0 && 'Create a branch first, then add routes.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {routes.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/routes/${r.id}`}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-neutral-200 hover:border-primary-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-50">
                        <MapPin className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{r.name}</p>
                        <p className="text-sm text-neutral-500">{r.branchName ?? '—'}</p>
                        <p className="text-xs text-neutral-400">{r.customerCount ?? 0} customer(s), {r.staffCount ?? 0} staff</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <Modal
          isOpen={true}
          title="Add Branch"
          onClose={() => !saving && setShowBranchModal(false)}
        >
          <form onSubmit={handleCreateBranch} className="space-y-4">
            <Input
              label="Branch name"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              required
              placeholder="e.g. Main Warehouse"
            />
            <Input
              label="Address (optional)"
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              placeholder="Full address"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowBranchModal(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Branch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Route Modal */}
      {showRouteModal && (
        <Modal
          isOpen={true}
          title="Add Route"
          onClose={() => !saving && setShowRouteModal(false)}
        >
          <form onSubmit={handleCreateRoute} className="space-y-4">
            <Input
              label="Route name"
              value={routeForm.name}
              onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
              required
              placeholder="e.g. North Route"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-700">Branch</label>
              <select
                value={routeForm.branchId}
                onChange={(e) => setRouteForm({ ...routeForm, branchId: e.target.value })}
                required
                className="block w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowRouteModal(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Route'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default BranchesPage

