import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  RefreshCw
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select, TextArea } from '../../components/Form'
import Modal from '../../components/Modal'
import { ModernTable, StatCard } from '../../components/ui'
import toast from 'react-hot-toast'

const SuperAdminTenantsPage = () => {
  const navigate = useNavigate()
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
      toast.error('Failed to load companies')
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
      toast.error('Failed to suspend company')
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
      toast.error('Failed to activate company')
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
        toast.error(response.message || 'Failed to delete company')
      }
    } catch (error) {
      toast.error('Failed to delete company')
    } finally {
      setDeleteLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase()
    const badges = {
      active: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>,
      trial: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>,
      suspended: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Suspended</span>,
      expired: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Expired</span>
    }
    return badges[statusLower] || <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '')
  const logoUrl = (tenant) => {
    const path = tenant?.logoPath || tenant?.logo
    if (!path) return null
    return path.startsWith('http') ? path : `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`
  }

  const columns = [
    { key: 'company', label: 'Company' },
    { key: 'name', label: 'Company Name' },
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

  const tableData = tenants.map(tenant => ({
    ...tenant,
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
        <span className="font-medium text-neutral-900 truncate max-w-[140px]" title={tenant.name}>{tenant.name || '—'}</span>
      </div>
    ),
    totalRevenue: formatCurrency(tenant.totalRevenue || 0),
    status: getStatusBadge(tenant.status),
    plan: tenant.planName ? <span className="text-neutral-700">{tenant.planName}</span> : <span className="text-neutral-400">—</span>,
    lastActivity: tenant.lastActivity
      ? new Date(tenant.lastActivity).toLocaleDateString(undefined, { dateStyle: 'short' })
      : <span className="text-neutral-400">—</span>,
    createdAt: new Date(tenant.createdAt).toLocaleDateString(),
    actions: (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            localStorage.setItem('selected_tenant_id', tenant.id)
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

      {/* Table */}
      {loading ? (
        <LoadingCard />
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
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

            if (response.success) {
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
            toast.error(error.response?.data?.message || 'Failed to create company')
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
    </div>
  )
}

export default SuperAdminTenantsPage

