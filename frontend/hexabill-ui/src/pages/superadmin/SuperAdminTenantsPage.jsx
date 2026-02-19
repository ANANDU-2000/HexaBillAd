import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Ban,
  CheckCircle,
  LogIn,
  AlertTriangle,
  Building2,
  Filter,
  RefreshCw,
  Copy,
  CalendarPlus,
  Megaphone
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { getApiBaseUrlNoSuffix } from '../../services/apiConfig'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select, TextArea } from '../../components/Form'
import Modal from '../../components/Modal'
import { ModernTable, StatCard } from '../../components/ui'
import toast from 'react-hot-toast'

const SuperAdminTenantsPage = () => {
  const navigate = useNavigate()
  const { impersonateTenant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [createFormData, setCreateFormData] = useState({
    name: '',
    companyNameEn: '',
    companyNameAr: '',
    email: '',
    phone: '',
    country: 'AE',
    currency: 'AED',
    vatNumber: '',
    address: '',
    status: 'Trial',
    trialDays: '14'
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentialsData, setCredentialsData] = useState(null)
  const [credentialsAcknowledged, setCredentialsAcknowledged] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkExtendModal, setShowBulkExtendModal] = useState(false)
  const [showBulkAnnouncementModal, setShowBulkAnnouncementModal] = useState(false)
  const [bulkExtendDays, setBulkExtendDays] = useState(7)
  const [bulkAnnouncementTitle, setBulkAnnouncementTitle] = useState('')
  const [bulkAnnouncementMessage, setBulkAnnouncementMessage] = useState('')
  const [bulkAnnouncementSeverity, setBulkAnnouncementSeverity] = useState('Info')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  useEffect(() => {
    fetchTenants()
  }, [currentPage, searchTerm, statusFilter])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        pageSize,
        search: searchTerm || undefined,
        status: statusFilter || undefined
      }
      const response = await superAdminAPI.getTenants(params)
      if (response.success) {
        setTenants(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || 'Failed to load companies')
      }
    } catch (error) {
      console.error('Error loading companies:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const handleSuspend = async () => {
    if (!selectedTenant) return

    try {
      const response = await superAdminAPI.suspendTenant(selectedTenant.id, suspendReason || 'Suspended by Super Admin')
      if (response.success) {
        toast.success('Company suspended successfully')
        setShowSuspendModal(false)
        setSelectedTenant(null)
        setSuspendReason('')
        fetchTenants()
      } else {
        toast.error(response.message || 'Failed to suspend company')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to suspend company')
    }
  }

  const handleActivate = async (tenantId) => {
    try {
      const response = await superAdminAPI.activateTenant(tenantId)
      if (response.success) {
        toast.success('Company activated successfully')
        fetchTenants()
      } else {
        toast.error(response.message || 'Failed to activate company')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to activate company')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === tenants.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(tenants.map((t) => t.id)))
  }
  const handleBulkExtendTrial = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setBulkActionLoading(true)
    try {
      const res = await superAdminAPI.bulkAction({
        tenantIds: ids,
        action: 'extend_trial',
        days: bulkExtendDays || 7
      })
      if (res?.success && res?.data) {
        const { successCount, failureCount } = res.data
        toast.success(`Trial extended for ${successCount} compan${successCount === 1 ? 'y' : 'ies'}${failureCount ? `; ${failureCount} failed` : ''}`)
        setShowBulkExtendModal(false)
        setSelectedIds(new Set())
        fetchTenants()
      } else {
        toast.error(res?.message || 'Bulk action failed')
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error(e?.response?.data?.message || 'Bulk action failed')
    } finally {
      setBulkActionLoading(false)
    }
  }
  const handleBulkAnnouncement = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setBulkActionLoading(true)
    try {
      const res = await superAdminAPI.bulkAction({
        tenantIds: ids,
        action: 'send_announcement',
        title: bulkAnnouncementTitle || 'Platform announcement',
        message: bulkAnnouncementMessage || '',
        severity: bulkAnnouncementSeverity || 'Info'
      })
      if (res?.success && res?.data) {
        const { successCount, failureCount } = res.data
        toast.success(`Announcement sent to ${successCount} compan${successCount === 1 ? 'y' : 'ies'}${failureCount ? `; ${failureCount} failed` : ''}`)
        setShowBulkAnnouncementModal(false)
        setBulkAnnouncementTitle('')
        setBulkAnnouncementMessage('')
        setSelectedIds(new Set())
        fetchTenants()
      } else {
        toast.error(res?.message || 'Bulk action failed')
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error(e?.response?.data?.message || 'Bulk action failed')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTenant) return

    try {
      setDeleteLoading(true)
      const response = await superAdminAPI.deleteTenant(selectedTenant.id)
      if (response.success) {
        toast.success('Company deleted successfully')
        setShowDeleteModal(false)
        setSelectedTenant(null)
        fetchTenants()
      } else {
        const detail = response.errors?.[0] || response.message
        toast.error(detail || 'Failed to delete company')
      }
    } catch (error) {
      // BUG #2.2 FIX: Enhanced error handling - show detailed error messages from backend
      const errorMsg = error?.response?.data?.errors?.[0] ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to delete company. Please check the console for details.'
      if (!error?._handledByInterceptor) {
        toast.error(errorMsg, { duration: 6000 }) // Show for 6 seconds for important errors
      }
      console.error('Delete tenant error:', {
        error,
        response: error?.response?.data,
        status: error?.response?.status
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const getStatusBadge = (status, subscriptionStatus) => {
    // Priority to subscription status if available & valid, else fall back to tenant status
    const effectiveStatus = (subscriptionStatus || status || '').toLowerCase()

    const badges = {
      active: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>,
      trial: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>,
      suspended: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Suspended</span>,
      expired: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Expired</span>
    }
    return badges[effectiveStatus] || <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{effectiveStatus}</span>
  }

  const apiBase = getApiBaseUrlNoSuffix()
  const logoUrl = (tenant) => {
    const path = tenant?.logoPath || tenant?.logo
    if (!path) return null
    if (path.startsWith('http')) return path
    // Backend may return "logo_xxx.png" or "/uploads/logo_xxx.png" – serve from /uploads/
    const normalized = path.startsWith('/') ? path : `/uploads/${path}`
    return `${apiBase}${normalized}`
  }

  const columns = [
    { key: 'select', label: '' },
    { key: 'company', label: 'Company' },
    { key: 'clientId', label: 'Client ID' },
    {
      key: 'name', label: (
        <div className="flex flex-col">
          <span>Company Name</span>
          <span className="text-[10px] font-normal text-neutral-400">English / Arabic</span>
        </div>
      )
    },
    { key: 'country', label: 'Country' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'plan', label: 'Plan' },
    { key: 'lastActivity', label: 'Last Activity' },
    { key: 'userCount', label: 'Users' },
    { key: 'invoiceCount', label: 'Invoices' },
    { key: 'totalRevenue', label: 'Revenue' },
    { key: 'createdAt', label: 'Created' },
    { key: 'actions', label: 'Actions' }
  ]

  const copyClientId = (e, id) => {
    e?.stopPropagation?.()
    navigator.clipboard?.writeText(String(id))
    toast.success('Client ID copied')
  }

  const tableData = tenants.map(tenant => ({
    ...tenant,
    name: (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900" title={tenant.name || tenant.companyNameEn || 'Unnamed Company'}>
          {(tenant.name && tenant.name.trim()) || (tenant.companyNameEn && tenant.companyNameEn.trim()) || 'Unnamed Company'}
        </span>
        {tenant.companyNameEn && tenant.companyNameEn.trim() && tenant.companyNameEn.trim() !== (tenant.name?.trim() || '') && (
          <span className="text-xs text-neutral-500 truncate max-w-[160px]" title={tenant.companyNameEn}>{tenant.companyNameEn}</span>
        )}
        {tenant.companyNameAr && tenant.companyNameAr.trim() && (
          <span className="text-xs text-neutral-400 truncate max-w-[160px]" dir="rtl" title={tenant.companyNameAr}>{tenant.companyNameAr}</span>
        )}
      </div>
    ),
    select: (
      <input
        type="checkbox"
        checked={selectedIds.has(tenant.id)}
        onChange={() => toggleSelect(tenant.id)}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-neutral-300"
      />
    ),
    clientId: (
      <div className="flex items-center gap-1">
        <code className="text-xs bg-neutral-100 px-2 py-1 rounded font-mono">{tenant.id}</code>
        <button type="button" onClick={(e) => copyClientId(e, tenant.id)} className="p-1 hover:bg-neutral-200 rounded" title="Copy">
          <Copy className="h-3.5 w-3.5 text-neutral-500" />
        </button>
      </div>
    ),
    company: (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logoUrl(tenant) ? (
            <img src={logoUrl(tenant)} alt="" className="h-full w-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden') }} />
          ) : null}
          <span className={logoUrl(tenant) ? 'hidden text-neutral-500 font-semibold text-sm' : 'text-neutral-500 font-semibold text-sm'}>
            {(tenant.name || 'C').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-neutral-900 truncate max-w-[140px]" title={tenant.name}>{tenant.name || '—'}</span>
          {tenant.companyNameEn && tenant.companyNameEn !== tenant.name && (
            <span className="text-xs text-neutral-500 truncate max-w-[160px]">{tenant.companyNameEn}</span>
          )}
          {tenant.companyNameAr && (
            <span className="text-xs text-neutral-400 truncate max-w-[160px]" dir="rtl">{tenant.companyNameAr}</span>
          )}
        </div>
      </div>
    ),
    totalRevenue: formatCurrency(tenant.totalRevenue || 0),
    status: getStatusBadge(tenant.status, tenant.subscription?.status),
    plan: tenant.planName ? <span className="text-neutral-700">{tenant.planName}</span> : <span className="text-neutral-400">—</span>,
    lastActivity: tenant.lastActivity
      ? new Date(tenant.lastActivity).toLocaleDateString(undefined, { dateStyle: 'short' })
      : <span className="text-neutral-400">—</span>,
    createdAt: new Date(tenant.createdAt).toLocaleDateString(),
    actions: (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            impersonateTenant(tenant.id)
            localStorage.setItem('selected_tenant_name', tenant.name)
            toast.success(`Entering ${tenant.name}'s workspace...`)
            window.location.href = '/dashboard'
          }}
          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
          title="Enter Workspace"
        >
          <LogIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        {tenant.status?.toLowerCase() === 'suspended' ? (
          <button
            onClick={() => handleActivate(tenant.id)}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Activate"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => {
              setSelectedTenant(tenant)
              setShowSuspendModal(true)
            }}
            className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
            title="Suspend"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => {
            setSelectedTenant(tenant)
            setShowDeleteModal(true)
          }}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Companies</h1>
          <p className="text-neutral-500 mt-1">Manage and monitor all platform organizations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-sm hover:shadow-md transition-all space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add New Company</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Businesses"
          value={totalCount}
          icon={Building2}
          format="number"
        />
        <StatCard
          title="Active Instances"
          value={tenants.filter(t => t.status === 'Active').length}
          icon={CheckCircle}
          format="number"
        />
        <StatCard
          title="Trial Users"
          value={tenants.filter(t => t.status === 'Trial').length}
          icon={RefreshCw}
          format="number"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Search"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            icon={<Search className="h-5 w-5 text-gray-400" />}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Trial">Trial</option>
            <option value="Suspended">Suspended</option>
            <option value="Expired">Expired</option>
          </Select>
          <div className="flex items-end">
            <button
              onClick={fetchTenants}
              className="w-full flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-indigo-900">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkExtendModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
            >
              <CalendarPlus className="h-4 w-4" />
              Extend trial
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAnnouncementModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Megaphone className="h-4 w-4" />
              Send announcement
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-200 rounded-lg text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingCard />
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
          {tenants.length > 0 && (
            <div className="px-4 py-2 border-b border-neutral-100 text-sm text-neutral-600">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-indigo-600 hover:underline"
              >
                {selectedIds.size === tenants.length ? 'Clear selection' : 'Select all on this page'}
              </button>
            </div>
          )}
          <ModernTable
            columns={columns}
            data={tableData}
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / pageSize)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Suspend Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false)
          setSelectedTenant(null)
          setSuspendReason('')
        }}
        title="Suspend Company"
      >
        <div className="p-1">
          <div className="flex items-center space-x-3 text-amber-600 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <Ban className="h-6 w-6" />
            <p className="font-medium">You are about to suspend this company's access.</p>
          </div>

          <p className="text-gray-600 mb-6">
            Are you sure you want to suspend <strong>{selectedTenant?.name}</strong>? All users in this company will lose access until reactivated.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Reason for Suspension
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              rows={3}
              placeholder="e.g., Unpaid subscription, Violation of terms..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={() => {
                setShowSuspendModal(false)
                setSelectedTenant(null)
                setSuspendReason('')
              }}
              className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleSuspend}
              className="px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 shadow-md hover:shadow-lg transition-all"
            >
              Suspend Access
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Bulk: Extend trial */}
      <Modal
        isOpen={showBulkExtendModal}
        onClose={() => setShowBulkExtendModal(false)}
        title="Extend trial (bulk)"
      >
        <div className="p-1">
          <p className="text-neutral-600 mb-4">
            Extend trial end date for <strong>{selectedIds.size}</strong> selected companies.
          </p>
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-semibold text-neutral-700">Days to add</label>
            <input
              type="number"
              min={1}
              max={365}
              value={bulkExtendDays}
              onChange={(e) => setBulkExtendDays(Number(e.target.value) || 7)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowBulkExtendModal(false)} className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg">
              Cancel
            </button>
            <LoadingButton onClick={handleBulkExtendTrial} loading={bulkActionLoading} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
              Extend trial
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Bulk: Send announcement */}
      <Modal
        isOpen={showBulkAnnouncementModal}
        onClose={() => { setShowBulkAnnouncementModal(false); setBulkAnnouncementTitle(''); setBulkAnnouncementMessage('') }}
        title="Send announcement (bulk)"
      >
        <div className="p-1">
          <p className="text-neutral-600 mb-4">
            Create an in-app announcement for <strong>{selectedIds.size}</strong> selected companies. Users will see it in their Alerts.
          </p>
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-semibold text-neutral-700">Title</label>
            <input
              type="text"
              value={bulkAnnouncementTitle}
              onChange={(e) => setBulkAnnouncementTitle(e.target.value)}
              placeholder="Platform announcement"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-semibold text-neutral-700">Message</label>
            <textarea
              value={bulkAnnouncementMessage}
              onChange={(e) => setBulkAnnouncementMessage(e.target.value)}
              placeholder="Optional message..."
              rows={3}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-semibold text-neutral-700">Severity</label>
            <select
              value={bulkAnnouncementSeverity}
              onChange={(e) => setBulkAnnouncementSeverity(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            >
              <option value="Info">Info</option>
              <option value="Warning">Warning</option>
              <option value="Error">Error</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowBulkAnnouncementModal(false); setBulkAnnouncementTitle(''); setBulkAnnouncementMessage('') }} className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg">
              Cancel
            </button>
            <LoadingButton onClick={handleBulkAnnouncement} loading={bulkActionLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Send announcement
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Create Tenant Modal - REMAKEN */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setCreateFormData({
            name: '',
            companyNameEn: '',
            companyNameAr: '',
            email: '',
            phone: '',
            country: 'AE',
            currency: 'AED',
            vatNumber: '',
            address: '',
            status: 'Trial',
            trialDays: '14'
          })
        }}
        title="Create New Company"
        size="2xl"
        closeOnOverlayClick={false}
      >
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (createLoading) return
          if (!createFormData.name.trim()) {
            toast.error('Company name is required')
            return
          }
          try {
            setCreateLoading(true)
            const response = await superAdminAPI.createTenant({
              ...createFormData,
              name: createFormData.name.trim(),
              companyNameEn: createFormData.companyNameEn?.trim() || undefined,
              companyNameAr: createFormData.companyNameAr?.trim() || undefined,
              email: createFormData.email?.trim() || undefined,
              phone: createFormData.phone?.trim() || undefined,
              vatNumber: createFormData.vatNumber?.trim() || undefined,
              address: createFormData.address?.trim() || undefined,
              trialDays: createFormData.status === 'Trial' ? Number(createFormData.trialDays) : undefined,
              trialEndDate: undefined // Let backend handle via trialDays
            })

            if (response.success && response.data?.clientCredentials) {
              setCredentialsData(response.data.clientCredentials)
              setCredentialsAcknowledged(false)
              setShowCreateModal(false)
              setCreateFormData({
                name: '',
                companyNameEn: '',
                companyNameAr: '',
                email: '',
                phone: '',
                country: 'AE',
                currency: 'AED',
                vatNumber: '',
                address: '',
                status: 'Trial',
                trialDays: 14
              })
              setShowCredentialsModal(true)
              fetchTenants()
            } else if (response.success) {
              toast.success('Company created successfully')
              setShowCreateModal(false)
              setCreateFormData({
                name: '',
                companyNameEn: '',
                companyNameAr: '',
                email: '',
                phone: '',
                country: 'AE',
                currency: 'AED',
                vatNumber: '',
                address: '',
                status: 'Trial',
                trialDays: 14
              })
              fetchTenants()
            } else {
              toast.error(response.message || 'Failed to create company')
            }
          } catch (error) {
            if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to create company')
          } finally {
            setCreateLoading(false)
          }
        }} className="space-y-6 max-h-[80vh] overflow-y-auto px-1">

          {/* Section 1: Identity & Contact */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 text-primary-600 mb-2">
              <Building2 className="h-5 w-5" />
              <h3 className="font-bold text-slate-800">Primary Identity</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Company Display Name"
                placeholder="e.g. Acme Corp"
                required
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                className="bg-white"
              />
              <Input
                label="Owner Email Address"
                type="email"
                placeholder="admin@company.com"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                className="bg-white"
              />
              <div className="md:col-span-2">
                <Input
                  label="Contact Phone"
                  placeholder="+971 50 123 4567"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Legal & Business Details */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 text-primary-600 mb-2">
              <Filter className="h-5 w-5" />
              <h3 className="font-bold text-slate-800">Business Registration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Company Name (English)"
                placeholder="Acme Trading LLC"
                value={createFormData.companyNameEn}
                onChange={(e) => setCreateFormData({ ...createFormData, companyNameEn: e.target.value })}
                className="bg-white"
              />
              <Input
                label="Company Name (Arabic)"
                placeholder="شركة اكمي للتجارة"
                dir="rtl"
                value={createFormData.companyNameAr}
                onChange={(e) => setCreateFormData({ ...createFormData, companyNameAr: e.target.value })}
                className="bg-white"
              />
              <Input
                label="VAT Number"
                placeholder="100xxxxxxxxxxxx"
                value={createFormData.vatNumber}
                onChange={(e) => setCreateFormData({ ...createFormData, vatNumber: e.target.value })}
                className="bg-white"
              />
              <Input
                label="Physical Address"
                placeholder="Street, City, Building"
                value={createFormData.address}
                onChange={(e) => setCreateFormData({ ...createFormData, address: e.target.value })}
                className="bg-white"
              />
            </div>
          </div>

          {/* Section 3: Configuration */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 text-primary-600 mb-2">
              <RefreshCw className="h-5 w-5" />
              <h3 className="font-bold text-slate-800">Localization & Plan</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select
                label="Operating Country"
                value={createFormData.country}
                onChange={(e) => setCreateFormData({ ...createFormData, country: e.target.value })}
                className="bg-white"
              >
                <option value="AE">United Arab Emirates</option>
                <option value="SA">Saudi Arabia</option>
                <option value="KW">Kuwait</option>
                <option value="QA">Qatar</option>
                <option value="BH">Bahrain</option>
                <option value="OM">Oman</option>
              </Select>

              <Select
                label="Base Currency"
                value={createFormData.currency}
                onChange={(e) => setCreateFormData({ ...createFormData, currency: e.target.value })}
                className="bg-white"
              >
                <option value="AED">AED - UAE Dirham</option>
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="KWD">KWD - Kuwaiti Dinar</option>
                <option value="QAR">QAR - Qatari Riyal</option>
                <option value="BHD">BHD - Bahraini Dinar</option>
                <option value="OMR">OMR - Omani Rial</option>
              </Select>

              <Select
                label="Account Status"
                value={createFormData.status}
                onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value })}
                className="bg-white"
              >
                <option value="Trial">Free Trial</option>
                <option value="Active">Active / Paid</option>
                <option value="Suspended">Suspended</option>
              </Select>

              {createFormData.status === 'Trial' && (
                <Input
                  label="Trial Duration (Days)"
                  type="number"
                  min="1"
                  value={createFormData.trialDays}
                  onChange={(e) => setCreateFormData({ ...createFormData, trialDays: e.target.value })}
                  className="bg-white"
                />
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setCreateFormData({
                  name: '',
                  companyNameEn: '',
                  companyNameAr: '',
                  email: '',
                  phone: '',
                  country: 'AE',
                  currency: 'AED',
                  vatNumber: '',
                  address: '',
                  status: 'Trial',
                  trialDays: 14
                })
              }}
              className="px-6 py-3 border border-slate-300 text-slate-600 font-semibold rounded-2xl hover:bg-slate-50 transition-colors"
            >
              Discard Changes
            </button>
            <LoadingButton
              type="submit"
              loading={createLoading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-2xl hover:shadow-lg hover:from-blue-700 hover:to-indigo-800 transition-all transform hover:-translate-y-0.5"
            >
              Open Company
            </LoadingButton>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedTenant(null)
        }}
        title="Delete Company"
        size="md"
      >
        <div className="p-1">
          <div className="flex items-center space-x-3 text-red-600 mb-4 bg-red-50 p-4 rounded-xl border border-red-100">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-bold">Permanent Deletion</span>
          </div>
          <p className="text-neutral-600 mb-6">
            Are you sure you want to delete <span className="font-bold text-neutral-900">{selectedTenant?.name}</span>?
            This will permanently remove all associated data, users, and records. This action cannot be reversed.
          </p>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedTenant(null)
              }}
              className="px-5 py-2.5 text-neutral-500 font-medium hover:bg-neutral-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleDelete}
              loading={deleteLoading}
              className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 shadow-sm transition-all"
            >
              Delete Permanently
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* One-Time Credentials Modal - cannot be reopened */}
      <Modal
        isOpen={showCredentialsModal}
        onClose={() => { }}
        title="Company Credentials — Save Now"
        size="lg"
        closeOnOverlayClick={false}
        showCloseButton={false}
      >
        <div className="space-y-6 p-2">
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm font-medium">
            These credentials are shown only once. Save them before closing.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Login URL</label>
              <p className="font-mono text-sm bg-gray-100 p-3 rounded border break-all">{credentialsData?.clientAppLink || '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Owner Email</label>
              <p className="font-mono text-sm bg-gray-100 p-3 rounded border">{credentialsData?.email || '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Temporary Password</label>
              <p className="font-mono text-sm bg-gray-100 p-3 rounded border">{credentialsData?.password || '—'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const text = `Login URL: ${credentialsData?.clientAppLink || ''}\nEmail: ${credentialsData?.email || ''}\nPassword: ${credentialsData?.password || ''}`
                navigator.clipboard.writeText(text).then(() => toast.success('Credentials copied to clipboard', { id: 'credentials-copy' })).catch(() => toast.error('Failed to copy to clipboard'))
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Copy className="h-4 w-4" />
              Copy All Credentials
            </button>
            <a
              href={`mailto:${credentialsData?.email || ''}?subject=${encodeURIComponent('Your HexaBill Company Login Credentials')}&body=${encodeURIComponent(
                `Your HexaBill company account has been created.\n\nLogin URL: ${credentialsData?.clientAppLink || ''}\nEmail: ${credentialsData?.email || ''}\nPassword: ${credentialsData?.password || ''}\n\nPlease save these credentials securely.`
              )}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium no-underline"
            >
              Send via Email
            </a>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={credentialsAcknowledged}
              onChange={(e) => setCredentialsAcknowledged(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">I've saved these details</span>
          </label>
          <div className="flex justify-end pt-4 border-t">
            <button
              type="button"
              disabled={!credentialsAcknowledged}
              onClick={() => {
                setShowCredentialsModal(false)
                setCredentialsData(null)
                setCredentialsAcknowledged(false)
                fetchTenants() // Refresh list after closing credentials modal
              }}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SuperAdminTenantsPage

