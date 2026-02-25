import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  ArrowLeft,
  Edit,
  Ban,
  CheckCircle,
  Users,
  FileText,
  Package,
  DollarSign,
  Database,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Building2,
  Trash2,
  LogIn,
  LogOut,
  ShoppingCart,
  Receipt,
  BarChart3,
  List,
  Wallet,
  Settings,
  History,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BookOpen,
  UserPlus,
  Shield,
  CheckCircle2,
  RefreshCw,
  Lock,
  Sliders,
  User as UserIcon,
  Copy,
  Info,
  Download,
  Zap,
  AlertTriangle,
  ToggleLeft,
  XCircle
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { Input, Select } from '../../components/Form'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'

const SuperAdminTenantDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { impersonateTenant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // User management state
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [loadingAction, setLoadingAction] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showClearDataModal, setShowClearDataModal] = useState(false)
  const [showDuplicateDataModal, setShowDuplicateDataModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [plans, setPlans] = useState([])
  const [clearDataConfirmation, setClearDataConfirmation] = useState('')
  const [clearDataCheckbox, setClearDataCheckbox] = useState(false)
  const [tenantsList, setTenantsList] = useState([])
  const [duplicateSourceTenantId, setDuplicateSourceTenantId] = useState('')
  const [duplicateDataTypes, setDuplicateDataTypes] = useState({ Products: true, Settings: true })
  const [duplicatePreview, setDuplicatePreview] = useState(null)
  const [duplicatePreviewLoading, setDuplicatePreviewLoading] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showLockoutModal, setShowLockoutModal] = useState(false)
  const [lockoutEmail, setLockoutEmail] = useState('')
  const [lockoutAction, setLockoutAction] = useState('unlock') // 'unlock' | 'lock'
  const [lockoutDuration, setLockoutDuration] = useState(15)
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    planId: '',
    billingCycle: 0 // 0 = Monthly, 1 = Yearly
  })
  const [editFormData, setEditFormData] = useState({
    status: 'Active'
  })

  const [tenantHealth, setTenantHealth] = useState(null)
  const [tenantRequestUsage, setTenantRequestUsage] = useState(null)
  const [limitsData, setLimitsData] = useState({ maxRequestsPerMinute: 200, maxConcurrentUsers: 50, maxStorageMb: 1024, maxInvoicesPerMonth: 1000 })
  const [limitsLoading, setLimitsLoading] = useState(false)
  const [limitsSaving, setLimitsSaving] = useState(false)
  const [invoicesData, setInvoicesData] = useState(null)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState(null)
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [dangerModal, setDangerModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => { }
  })

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    phone: ''
  })

  const fetchPlans = async () => {
    try {
      const response = await superAdminAPI.getSubscriptionPlans()
      if (response.success) {
        setPlans(response.data)
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const fetchTenant = async (tenantId) => {
    const tid = tenantId ?? id
    if (!tid) return
    try {
      setLoading(true)
      setError(null)
      setTenant(null)
      const response = await superAdminAPI.getTenant(parseInt(tid))
      if (response?.success && response?.data) {
        setTenant(response.data)
      } else {
        setError(response?.message || 'Failed to load company details')
      }
    } catch (err) {
      console.error('Error loading tenant:', err)
      if (!err?._handledByInterceptor) {
        const data = err?.response?.data
        const msg = data?.errors?.[0] || data?.message || 'Failed to load company details'
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchTenant(id)
      fetchPlans()
    }
  }, [id])

  useEffect(() => {
    if (id && activeTab === 'overview') {
      superAdminAPI.getTenantHealth(parseInt(id))
        .then((res) => res?.success && res?.data && setTenantHealth(res.data))
        .catch(() => setTenantHealth(null))
    }
  }, [id, activeTab])

  useEffect(() => {
    if (!id || (activeTab !== 'overview' && activeTab !== 'limits')) return
    superAdminAPI.getTenantRequestUsage(parseInt(id))
      .then((res) => res?.success && res?.data != null && setTenantRequestUsage(res.data))
      .catch(() => setTenantRequestUsage(null))
  }, [id, activeTab])

  useEffect(() => {
    if (id && activeTab === 'invoices') {
      setInvoicesLoading(true)
      superAdminAPI.getTenantInvoices(parseInt(id), invoicesPage, 20)
        .then((res) => {
          if (res?.success && res?.data) setInvoicesData(res.data)
          else setInvoicesData(null)
        })
        .catch(() => setInvoicesData(null))
        .finally(() => setInvoicesLoading(false))
    }
  }, [id, activeTab, invoicesPage])

  useEffect(() => {
    if (id && activeTab === 'payments') {
      setPaymentHistoryLoading(true)
      superAdminAPI.getTenantPaymentHistory(parseInt(id))
        .then((res) => {
          if (res?.success && Array.isArray(res?.data)) setPaymentHistory(res.data)
          else setPaymentHistory([])
        })
        .catch(() => setPaymentHistory([]))
        .finally(() => setPaymentHistoryLoading(false))
    }
  }, [id, activeTab])

  useEffect(() => {
    if (id && (activeTab === 'limits' || activeTab === 'overview')) {
      if (activeTab === 'limits') setLimitsLoading(true)
      superAdminAPI.getTenantLimits(parseInt(id))
        .then((res) => {
          const d = res?.data ?? res
          if (d && typeof d === 'object') {
            setLimitsData({
              maxRequestsPerMinute: d.maxRequestsPerMinute ?? 200,
              maxConcurrentUsers: d.maxConcurrentUsers ?? 50,
              maxStorageMb: d.maxStorageMb ?? 1024,
              maxInvoicesPerMonth: d.maxInvoicesPerMonth ?? 1000
            })
          }
        })
        .catch(() => { })
        .finally(() => setLimitsLoading(false))
    }
  }, [id, activeTab])

  const handleSuspend = async () => {
    if (!tenant || !suspendReason.trim()) return

    try {
      setLoadingAction(true)
      const response = await superAdminAPI.suspendTenant(tenant.id, suspendReason)
      if (response.success) {
        toast.success('Company suspended successfully')
        setShowSuspendModal(false)
        setSuspendReason('')
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to suspend company')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to suspend company')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleUpdateTenant = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.updateTenant(tenant.id, editFormData)
      if (response.success) {
        toast.success('Company updated successfully')
        setShowEditModal(false)
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to update company')
      }
    } catch (error) {
      toast.error('Failed to update company')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleActivate = async () => {
    if (!tenant) return

    try {
      const response = await superAdminAPI.activateTenant(tenant.id)
      if (response.success) {
        toast.success('Company activated successfully')
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to activate company')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to activate company')
    }
  }

  const handleEnterWorkspace = async () => {
    if (!tenant) return
    try {
      await superAdminAPI.impersonateEnter(tenant.id)
    } catch (_) { /* Audit logging failure should not block */ }
    impersonateTenant(tenant.id)
    localStorage.setItem('selected_tenant_name', tenant.name)
    toast.success(`Entering ${tenant.name}'s workspace`)
    window.location.href = '/dashboard'
  }

  const handleExportData = async () => {
    if (!id) return
    setExportLoading(true)
    try {
      const res = await superAdminAPI.getTenantExport(parseInt(id))
      const blob = res.data
      const disp = res.headers?.['content-disposition']
      const match = disp && /filename[*]?=(?:UTF-8'')?"?([^";\n]+)"?/i.exec(disp)
      const filename = match ? decodeURIComponent(match[1].trim()) : `export_tenant_${id}_${new Date().toISOString().slice(0, 10)}.zip`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const handleClearData = async () => {
    if (!clearDataCheckbox || clearDataConfirmation.trim().toUpperCase() !== 'CLEAR') {
      toast.error("Check the box and type CLEAR to confirm")
      return
    }

    try {
      setLoadingAction(true)
      const response = await superAdminAPI.clearTenantData(tenant.id)
      if (response.success) {
        toast.success('Company data cleared successfully')
        setShowClearDataModal(false)
        setClearDataConfirmation('')
        setClearDataCheckbox(false)
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to clear company data')
      }
    } catch (error) {
      // BUG #2.2 FIX: Enhanced error handling - show detailed error messages from backend
      const errorMsg = error?.response?.data?.errors?.[0] ||
        error?.response?.data?.message ||
        error?.message ||
        'An error occurred while clearing data. Please check the console for details.'
      if (!error?._handledByInterceptor) {
        toast.error(errorMsg, { duration: 6000 }) // Show for 6 seconds for important errors
      }
      console.error('Clear data error:', {
        error,
        response: error?.response?.data,
        status: error?.response?.status,
        innerException: error?.response?.data?.errors
      })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleOpenDuplicateModal = async () => {
    if (tenantsList.length === 0) {
      try {
        const res = await superAdminAPI.getTenants({ pageSize: 500 })
        if (res?.data?.items) setTenantsList(res.data.items)
        else if (Array.isArray(res?.data)) setTenantsList(res.data)
      } catch (e) {
        if (!e?._handledByInterceptor) toast.error('Failed to load companies list')
        return
      }
    }
    setDuplicateSourceTenantId('')
    setDuplicateDataTypes({ Products: true, Settings: true })
    setShowDuplicateDataModal(true)
  }

  // Fetch duplicate-data preview when source or data types change
  useEffect(() => {
    if (!showDuplicateDataModal || !tenant?.id || !duplicateSourceTenantId) {
      setDuplicatePreview(null)
      return
    }
    const sourceId = parseInt(duplicateSourceTenantId, 10)
    if (!sourceId || sourceId === tenant.id) {
      setDuplicatePreview(null)
      return
    }
    const types = Object.entries(duplicateDataTypes).filter(([, v]) => v).map(([k]) => k)
    if (types.length === 0) {
      setDuplicatePreview(null)
      return
    }
    let cancelled = false
    setDuplicatePreviewLoading(true)
    superAdminAPI.getDuplicateDataPreview(tenant.id, sourceId, types)
      .then((res) => {
        if (!cancelled && res?.success && res?.data) setDuplicatePreview(res.data)
        else if (!cancelled) setDuplicatePreview(null)
      })
      .catch(() => { if (!cancelled) setDuplicatePreview(null) })
      .finally(() => { if (!cancelled) setDuplicatePreviewLoading(false) })
    return () => { cancelled = true }
  }, [showDuplicateDataModal, tenant?.id, duplicateSourceTenantId, duplicateDataTypes])

  const handleDuplicateData = async () => {
    const sourceId = parseInt(duplicateSourceTenantId, 10)
    if (!sourceId || sourceId === tenant.id) {
      toast.error('Select a different company as source')
      return
    }
    const types = Object.entries(duplicateDataTypes).filter(([, v]) => v).map(([k]) => k)
    if (types.length === 0) {
      toast.error('Select at least one data type')
      return
    }
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.duplicateDataToTenant(tenant.id, sourceId, types)
      if (response?.success && response?.data) {
        const d = response.data
        toast.success(d.message || `Duplicated: ${d.productsCopied || 0} products, ${d.settingsCopied || 0} settings`)
        setShowDuplicateDataModal(false)
        fetchTenant()
      } else {
        toast.error(response?.message || 'Duplicate failed')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || 'An error occurred')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleUpdateSubscription = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.updateTenantSubscription(tenant.id, {
        planId: parseInt(subscriptionFormData.planId),
        billingCycle: parseInt(subscriptionFormData.billingCycle)
      })
      if (response.success) {
        toast.success('Subscription updated successfully')
        setShowSubscriptionModal(false)
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to update subscription')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('An error occurred while updating subscription')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (loadingAction) return
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.addTenantUser(tenant.id, userFormData)
      if (response.success) {
        toast.success('User added successfully')
        setShowAddUserModal(false)
        setUserFormData({ name: '', email: '', password: '', role: 'Staff', phone: '' })
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to add user')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to add user')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.updateTenantUser(tenant.id, selectedUser.id, userFormData)
      if (response.success) {
        toast.success('User updated successfully')
        setShowEditUserModal(false)
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to update user')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to update user')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDeleteUser = (userId) => {
    setDangerModal({
      isOpen: true,
      title: 'Delete User Account?',
      message: 'This user will lose all access to the system. This action cannot be reversed.',
      confirmLabel: 'Delete User',
      onConfirm: async () => {
        try {
          const response = await superAdminAPI.deleteTenantUser(tenant.id, userId)
          if (response.success) {
            toast.success('User deleted successfully')
            fetchTenant()
          } else {
            toast.error(response.message || 'Failed to delete user')
          }
        } catch (error) {
          if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to delete user')
        }
      }
    })
  }

  const handleForceLogout = (userId, userName) => {
    setDangerModal({
      isOpen: true,
      title: 'Force Logout User?',
      message: `Force ${userName || 'this user'} to log out immediately? They will need to log in again on their next request.`,
      confirmLabel: 'Force Logout',
      onConfirm: async () => {
        try {
          const response = await superAdminAPI.forceLogoutTenantUser(tenant.id, userId)
          if (response.success) {
            toast.success('User will be logged out on next request')
          } else {
            toast.error(response.message || 'Failed to force logout')
          }
        } catch (error) {
          if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to force logout')
        }
      }
    })
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    try {
      setLoadingAction(true)
      const response = await superAdminAPI.resetTenantUserPassword(tenant.id, selectedUser.id, { newPassword: userFormData.password })
      if (response.success) {
        toast.success('Password reset successfully')
        setShowPasswordModal(false)
      } else {
        toast.error(response.message || 'Failed to reset password')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error(error.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoadingAction(false)
    }
  }

  const getStatusBadge = (status, subscriptionStatus) => {
    // Priority to subscription status if available & valid, else fall back to tenant status
    const effectiveStatus = (subscriptionStatus || status || '').toLowerCase()

    const badges = {
      active: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Active</span>,
      trial: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>,
      suspended: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Suspended</span>,
      expired: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Expired</span>
    }
    return badges[effectiveStatus] || <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">{effectiveStatus}</span>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4 sm:p-6">
        <LoadingCard />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/superadmin/tenants')}
            className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to companies
          </button>
          <div className="bg-white border border-red-200 rounded-xl p-6">
            <p className="font-medium text-red-700 text-sm mb-1">Failed to load company</p>
            <p className="text-sm text-neutral-500">{error}</p>
            <button
              onClick={() => { setError(null); fetchTenant(id); }}
              className="mt-4 px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-700"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/superadmin/tenants')}
            className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to companies
          </button>
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <p className="text-sm text-neutral-500">Company not found.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/superadmin/tenants')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Companies</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
              <div className="flex items-center gap-1.5 bg-neutral-100 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-neutral-500">Database Client ID</span>
                <code className="text-sm font-mono font-semibold">{tenant.id}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(String(tenant.id))
                    toast.success('Client ID copied')
                  }}
                  className="p-1 hover:bg-neutral-200 rounded"
                  title="Copy Client ID"
                >
                  <Copy className="h-3.5 w-3.5 text-neutral-500" />
                </button>
              </div>
            </div>
            <p className="text-gray-600 mt-1">{tenant.companyNameEn || tenant.companyNameAr || 'No company name'}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleEnterWorkspace}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm"
              title="Enter Workspace"
            >
              <LogIn className="h-5 w-5" />
              <span>Enter Workspace</span>
            </button>
            {getStatusBadge(tenant.status, tenant.subscription?.status)}
            {tenant.status?.toLowerCase() === 'suspended' ? (
              <button
                onClick={handleActivate}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow-sm"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Activate Account</span>
              </button>
            ) : (
              <button
                onClick={() => setShowSuspendModal(true)}
                className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-bold shadow-sm"
              >
                <Ban className="h-5 w-5" />
                <span>Suspend Access</span>
              </button>
            )}
            <button
              onClick={() => {
                setEditFormData({
                  name: tenant.name,
                  companyNameEn: tenant.companyNameEn || '',
                  companyNameAr: tenant.companyNameAr || '',
                  email: tenant.email || '',
                  phone: tenant.phone || '',
                  country: tenant.country || 'AE',
                  currency: tenant.currency || 'AED',
                  vatNumber: tenant.vatNumber || '',
                  address: tenant.address || '',
                  status: tenant.status
                })
                setShowEditModal(true)
              }}
              className="flex items-center space-x-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-bold shadow-sm"
            >
              <Edit className="h-5 w-5" />
              <span>Edit Company</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs - overflow-x-auto for mobile to prevent overlapping */}
      <div className="border-b border-gray-200 mb-6 font-bold overflow-x-auto scrollbar-hide">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
          {['overview', 'users', 'invoices', 'payments', 'subscription', 'usage', 'limits', 'features', 'reports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-bold text-sm transition-all ${activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health Score Card */}
          {tenantHealth != null && (
            <div className={`rounded-lg border shadow-sm p-6 ${tenantHealth.level === 'Green' ? 'bg-green-50 border-green-200' :
              tenantHealth.level === 'Yellow' ? 'bg-amber-50 border-amber-200' :
                'bg-red-50 border-red-200'
              }`}>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Tenant Health Score
                <span
                  className="inline-flex text-gray-500 hover:text-gray-700 cursor-help"
                  title={tenantHealth.scoreDescription || 'Starts at 100. Deductions: trial expiring soon (−15 to −30), high outstanding vs revenue (−10 to −25), high storage (−20), no activity 30+ days (−10). Green ≥70, Yellow ≥40, Red <40.'}
                  aria-label="How health score is calculated"
                >
                  <Info className="h-5 w-5" />
                </span>
              </h2>
              {tenantHealth.scoreDescription && (
                <p className="text-sm text-gray-600 mb-4 max-w-2xl">{tenantHealth.scoreDescription}</p>
              )}
              <div className="flex flex-wrap items-center gap-6">
                <div className={`text-4xl font-bold ${tenantHealth.level === 'Green' ? 'text-green-700' :
                  tenantHealth.level === 'Yellow' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                  {tenantHealth.score}/100
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tenantHealth.level === 'Green' ? 'bg-green-200 text-green-800' :
                  tenantHealth.level === 'Yellow' ? 'bg-amber-200 text-amber-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                  {tenantHealth.level}
                </span>
                {(tenantHealth.riskFactors || []).length > 0 && (
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Risk factors:</p>
                    <ul className="text-sm text-gray-700 list-disc list-inside">
                      {(tenantHealth.riskFactors || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Client controls – single block: Suspend, Activate, Clear data, Lockout, Limits */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Client controls
            </h2>
            <p className="text-sm text-gray-600 mb-4">Account actions and limits. Use Limits tab for rate/storage caps.</p>
            <div className="flex flex-wrap gap-3">
              {tenant?.status?.toLowerCase() === 'suspended' ? (
                <button type="button" onClick={handleActivate} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium">
                  <CheckCircle className="h-4 w-4" /> Activate account
                </button>
              ) : (
                <button type="button" onClick={() => setShowSuspendModal(true)} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-medium">
                  <Ban className="h-4 w-4" /> Suspend access
                </button>
              )}
              <button type="button" onClick={() => setShowClearDataModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium">
                <Trash2 className="h-4 w-4" /> Clear data
              </button>
              <button type="button" onClick={() => { setLockoutAction('unlock'); setLockoutEmail(tenant?.users?.[0]?.email || ''); setShowLockoutModal(true) }} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium">
                <Lock className="h-4 w-4" /> Login lockout
              </button>
              <button type="button" onClick={() => setActiveTab('limits')} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">
                <Sliders className="h-4 w-4" /> Limits & rate
              </button>
            </div>
          </div>

          {/* Usage, storage, and upgrade reminder */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Usage & storage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-500 mb-1">API requests (last 60 min)</p>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  {tenantRequestUsage != null ? tenantRequestUsage.requestCountLast60Min ?? 0 : '—'}
                  {tenantRequestUsage?.isHighVolume && <span className="text-xs font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">High volume</span>}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Storage (estimate)</p>
                <p className="font-semibold text-gray-900">
                  {tenant?.usageMetrics != null ? `${(tenant.usageMetrics.storageEstimate ?? 0).toLocaleString()} rows` : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Limits</p>
                <p className="font-semibold text-gray-900">
                  {limitsData.maxRequestsPerMinute}/min · {limitsData.maxStorageMb} MB
                </p>
              </div>
            </div>
            {/* Upgrade reminder: trial ending or storage/usage near limit */}
            {(tenant?.subscription?.trialEndDate || tenant?.trialEndDate) && (() => {
              const endDate = new Date(tenant.subscription?.trialEndDate || tenant.trialEndDate)
              const daysLeft = Math.ceil((endDate - new Date()) / (24 * 60 * 60 * 1000))
              if (daysLeft <= 14 && daysLeft >= 0) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-amber-700">Remind this client to upgrade before {endDate.toLocaleDateString()} to avoid service interruption.</p>
                    </div>
                  </div>
                )
              }
              if (daysLeft < 0) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Trial ended</p>
                      <p className="text-sm text-red-700">Consider activating or upgrading this client.</p>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name</label>
                <p className="text-gray-900 mt-1">{tenant.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name (EN)</label>
                <p className="text-gray-900 mt-1">{tenant.companyNameEn || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name (AR)</label>
                <p className="text-gray-900 mt-1">{tenant.companyNameAr || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Country</label>
                <p className="text-gray-900 mt-1">{tenant.country}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Currency</label>
                <p className="text-gray-900 mt-1">{tenant.currency}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">VAT Number</label>
                <p className="text-gray-900 mt-1">{tenant.vatNumber || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900 mt-1 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {tenant.email || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-gray-900 mt-1 flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  {tenant.phone || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Data export (offboarding/compliance) #52 */}
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export data
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Download key data (invoices, customers, products) as a ZIP of CSV files for offboarding or compliance.
            </p>
            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {exportLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {exportLoading ? 'Preparing…' : 'Download ZIP (CSV)'}
            </button>
          </div>

          {/* Login Lockout - Super Admin can unlock/lock client login */}
          <div className="bg-amber-50 rounded-lg border border-amber-200 shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Login Lockout
            </h2>
            <p className="text-sm text-amber-800 mb-4">
              If a client is locked out (5 failed login attempts), unlock them instantly. Or manually lock a user&apos;s login.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setLockoutAction('unlock'); setLockoutEmail(tenant?.users?.[0]?.email || ''); setShowLockoutModal(true) }}
                className="bg-white text-green-700 border border-green-300 px-4 py-2 rounded-lg font-medium hover:bg-green-50 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Unlock Login
              </button>
              <button
                onClick={() => { setLockoutAction('lock'); setLockoutEmail(''); setShowLockoutModal(true) }}
                className="bg-white text-amber-700 border border-amber-300 px-4 py-2 rounded-lg font-medium hover:bg-amber-50 flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Lock Login
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-lg border border-red-100 shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold text-red-800 mb-4">Danger Zone</h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">Reset Database</h3>
                <p className="text-sm text-red-700 mt-1">
                  Wipe all transactions, sales, and expenses. Subscription and company settings are kept. Products and customers remain; stock and balances reset to 0. Create a backup first if needed.
                </p>
              </div>
              <button
                onClick={() => setShowClearDataModal(true)}
                className="bg-white text-red-600 border border-red-200 px-6 py-2.5 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
              >
                <History className="h-5 w-5" />
                Clear All Data
              </button>
              <button
                onClick={handleOpenDuplicateModal}
                className="bg-white text-blue-600 border border-blue-200 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
              >
                <Copy className="h-5 w-5" />
                Duplicate Data from Another Company
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoices (read-only)
          </h2>
          <p className="text-sm text-gray-500 mb-4">View-only list. No edit or impersonation. Use &quot;Enter Workspace&quot; to manage invoices.</p>
          {invoicesLoading ? (
            <LoadingCard />
          ) : invoicesData ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-2 font-medium text-neutral-600">Invoice #</th>
                      <th className="text-left py-2 font-medium text-neutral-600">Date</th>
                      <th className="text-left py-2 font-medium text-neutral-600">Customer</th>
                      <th className="text-right py-2 font-medium text-neutral-600">Total</th>
                      <th className="text-right py-2 font-medium text-neutral-600">Paid</th>
                      <th className="text-left py-2 font-medium text-neutral-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoicesData.items || []).map((inv) => (
                      <tr key={inv.id} className="border-b border-neutral-100">
                        <td className="py-2 font-mono">{inv.invoiceNo || inv.id}</td>
                        <td className="py-2 text-neutral-700">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}</td>
                        <td className="py-2">{inv.customerName || '—'}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(Number(inv.grandTotal) || 0)}</td>
                        <td className="py-2 text-right">{formatCurrency(Number(inv.paidAmount) || 0)}</td>
                        <td className="py-2">{inv.paymentStatus || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {((invoicesData.items || []).length === 0) && (
                <p className="py-6 text-center text-neutral-500">No invoices for this company.</p>
              )}
              {invoicesData.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200">
                  <span className="text-sm text-neutral-600">
                    Page {invoicesData.page} of {invoicesData.totalPages} · {invoicesData.totalCount} total
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={invoicesData.page <= 1}
                      onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={invoicesData.page >= (invoicesData.totalPages || 1)}
                      onClick={() => setInvoicesPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500">Could not load invoices.</p>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment history
          </h2>
          <p className="text-sm text-gray-500 mb-4">Subscription and payment method. When the tenant paid or started trial, renewals, and payment method.</p>
          {paymentHistoryLoading ? (
            <LoadingCard />
          ) : paymentHistory && paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 font-medium text-neutral-600">Plan</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Status</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Cycle</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Start</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Expires / Next billing</th>
                    <th className="text-right py-2 font-medium text-neutral-600">Amount</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Payment method</th>
                    <th className="text-left py-2 font-medium text-neutral-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100">
                      <td className="py-2 font-medium">{row.planName || '—'}</td>
                      <td className="py-2">{row.status || '—'}</td>
                      <td className="py-2">{row.billingCycle || '—'}</td>
                      <td className="py-2 text-neutral-700">{row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'}</td>
                      <td className="py-2 text-neutral-700">
                        {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : row.nextBillingDate ? new Date(row.nextBillingDate).toLocaleDateString() + ' (next)' : '—'}
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(Number(row.amount) || 0)} {row.currency || ''}</td>
                      <td className="py-2">{row.paymentMethod || '—'}</td>
                      <td className="py-2 text-neutral-600">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-neutral-500">No subscription or payment history for this company.</p>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Users ({tenant.users?.length || 0})</h2>
            <button
              onClick={() => {
                setUserFormData({ name: '', email: '', password: '', role: 'Staff', phone: '' })
                setShowAddUserModal(true)
              }}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <UserPlus className="h-5 w-5" />
              <span>Add User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenant.users?.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => { setSelectedUser(user); setUserFormData({ name: user.name, role: user.role, phone: user.phone || '' }); setShowEditUserModal(true); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }} title="Reset Password" className="text-green-600 hover:text-green-900"><CheckCircle2 className="h-4 w-4" /></button>
                        <button onClick={() => handleForceLogout(user.id, user.name)} title="Force Logout" className="text-amber-600 hover:text-amber-900"><LogOut className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-indigo-600" />
                Subscription Plan Details
              </h2>
              <button
                onClick={() => {
                  if (tenant.subscription) {
                    setSubscriptionFormData({
                      planId: tenant.subscription.plan.id,
                      billingCycle: tenant.subscription.billingCycle === 'Monthly' ? 0 : 1
                    })
                  } else {
                    setSubscriptionFormData({
                      planId: plans[0]?.id || '',
                      billingCycle: 0
                    })
                  }
                  setShowSubscriptionModal(true)
                }}
                className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Manage Subscription
              </button>
            </div>

            {tenant.subscription ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase">Current Plan</label>
                  <p className="text-2xl font-black text-gray-900 mt-1">{tenant.subscription.plan.name}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tenant.subscription.status === 'Active' ? 'bg-green-100 text-green-700' :
                      tenant.subscription.status === 'Trial' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {tenant.subscription.status}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">{tenant.subscription.billingCycle} Billing</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pricing</label>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    {formatCurrency(tenant.subscription.amount, tenant.subscription.currency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-bold flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Next Billing: {tenant.subscription.nextBillingDate ? new Date(tenant.subscription.nextBillingDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Features Included</label>
                  <ul className="mt-3 space-y-2">
                    <li className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {tenant.subscription.plan.maxUsers === -1 ? 'Unlimited' : tenant.subscription.plan.maxUsers} Users
                    </li>
                    <li className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {tenant.subscription.plan.maxInvoicesPerMonth === -1 ? 'Unlimited' : tenant.subscription.plan.maxInvoicesPerMonth} Invoices / Mo
                    </li>
                    <li className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {tenant.subscription.plan.maxStorageMB} MB Storage
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-600">No Active Subscription</h3>
                <p className="text-sm text-gray-400 mt-1">This company does not have a formal subscription plan assigned.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Plan Entitlements
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-bold text-gray-600">Advanced Reports</span>
                  {tenant.subscription?.plan.hasAdvancedReports ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Ban className="h-5 w-5 text-gray-300" />}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-bold text-gray-600">White Labeling</span>
                  {tenant.subscription?.plan.hasWhiteLabel ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Ban className="h-5 w-5 text-gray-300" />}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-bold text-gray-600">Custom Branding</span>
                  {tenant.subscription?.plan.hasCustomBranding ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Ban className="h-5 w-5 text-gray-300" />}
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-bold text-gray-600">Priority Support</span>
                  {tenant.subscription?.plan.hasPrioritySupport ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Ban className="h-5 w-5 text-gray-300" />}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                Timeline
              </h3>
              <div className="space-y-4 text-sm font-bold">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Member Since</span>
                  <span className="text-gray-900">{new Date(tenant.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Current Plan Start</span>
                  <span className="text-gray-900">{tenant.subscription ? new Date(tenant.subscription.startDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                {tenant.subscription?.trialEndDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Trial Period Ends</span>
                    <span className="text-red-600">{new Date(tenant.subscription.trialEndDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-900">{tenant.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'usage' && tenant.usageMetrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sales Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.invoiceCount}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Supplier Purchases</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.purchaseCount || 0}</p>
                </div>
                <ShoppingCart className="h-10 w-10 text-indigo-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expense Records</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.expenseCount || 0}</p>
                </div>
                <Receipt className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.customerCount}</p>
                </div>
                <Users className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Products</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.productCount}</p>
                </div>
                <Package className="h-10 w-10 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">System Users</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.usageMetrics.userCount}</p>
                </div>
                <Shield className="h-10 w-10 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Financial Summary</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Revenue</label>
                  <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(tenant.usageMetrics.totalRevenue)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Purchases</label>
                  <p className="text-xl font-bold text-indigo-600 mt-1">{formatCurrency(tenant.usageMetrics.totalPurchases || 0)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Expenses</label>
                  <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(tenant.usageMetrics.totalExpenses || 0)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Outstanding</label>
                  <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(tenant.usageMetrics.totalOutstanding || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'features' && (
        <TenantFeaturesTab tenantId={id} />
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              Company Data & Reports
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Products & Inventory', icon: <Package className="h-5 w-5" />, path: '/products', color: 'bg-blue-50 text-blue-700' },
                { label: 'Sales & POS Billing', icon: <TrendingUp className="h-5 w-5" />, path: '/pos', color: 'bg-green-50 text-green-700' },
                { label: 'Purchases & Suppliers', icon: <ShoppingCart className="h-5 w-5" />, path: '/purchases', color: 'bg-indigo-50 text-indigo-700' },
                { label: 'Expenses Tracking', icon: <Receipt className="h-5 w-5" />, path: '/expenses', color: 'bg-red-50 text-red-700' },
                { label: 'Customer Ledger', icon: <CreditCard className="h-5 w-5" />, path: '/ledger', color: 'bg-amber-50 text-amber-700' },
                { label: 'Financial Reports', icon: <FileText className="h-5 w-5" />, path: '/reports', color: 'bg-purple-50 text-purple-700' },
                { label: 'Sales Ledger', icon: <List className="h-5 w-5" />, path: '/sales-ledger', color: 'bg-teal-50 text-teal-700' },
                { label: 'Profit & Loss', icon: <Wallet className="h-5 w-5" />, path: '/reports?tab=profit-loss', color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Company Settings', icon: <Settings className="h-5 w-5" />, path: '/settings', color: 'bg-gray-50 text-gray-700' },
              ].map((report) => (
                <button
                  key={report.path}
                  onClick={async () => {
                    try {
                      await superAdminAPI.impersonateEnter(tenant.id)
                    } catch (_) { /* audit failure should not block */ }
                    impersonateTenant(tenant.id)
                    localStorage.setItem('selected_tenant_name', tenant.name)
                    toast.success(`Opening ${report.label} for ${tenant.name}...`)
                    navigate(report.path)
                  }}
                  className={`flex items-center p-4 rounded-xl border border-transparent hover:border-blue-300 transition-all duration-200 group ${report.color}`}
                >
                  <div className="p-2 rounded-lg bg-white shadow-sm mr-4 group-hover:scale-110 transition-transform">
                    {report.icon}
                  </div>
                  <span className="font-semibold text-sm">{report.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Sliders className="h-6 w-6 text-indigo-600" />
            Per-Tenant Limits & Rate Limiting
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure API rate limits and quotas for this company. When limits are exceeded, requests return 429.
          </p>
          {/* Request usage visibility */}
          <div className="mb-6 p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Requests (last 60 min):</span>
            <span className="font-semibold text-gray-900">{tenantRequestUsage != null ? (tenantRequestUsage.requestCountLast60Min ?? 0) : '—'}</span>
            {tenantRequestUsage?.isHighVolume && (
              <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">High volume</span>
            )}
            {tenantRequestUsage?.lastActiveAt && (
              <span className="text-xs text-gray-500">Last active: {new Date(tenantRequestUsage.lastActiveAt).toLocaleString()}</span>
            )}
          </div>
          {limitsLoading ? (
            <LoadingCard />
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setLimitsSaving(true)
                try {
                  await superAdminAPI.updateTenantLimits(parseInt(id), limitsData)
                  toast.success('Limits updated successfully')
                } catch (err) {
                  toast.error(err?.message || 'Failed to update limits')
                } finally {
                  setLimitsSaving(false)
                }
              }}
              className="space-y-6 max-w-xl"
            >
              <Input
                label="Max API requests per minute"
                type="number"
                min={1}
                max={2000}
                value={limitsData.maxRequestsPerMinute}
                onChange={(e) => setLimitsData({ ...limitsData, maxRequestsPerMinute: parseInt(e.target.value, 10) || 200 })}
              />
              <Input
                label="Max concurrent users"
                type="number"
                min={1}
                max={500}
                value={limitsData.maxConcurrentUsers}
                onChange={(e) => setLimitsData({ ...limitsData, maxConcurrentUsers: parseInt(e.target.value, 10) || 50 })}
              />
              <Input
                label="Max storage (MB)"
                type="number"
                min={1}
                max={10240}
                value={limitsData.maxStorageMb}
                onChange={(e) => setLimitsData({ ...limitsData, maxStorageMb: parseInt(e.target.value, 10) || 1024 })}
              />
              <Input
                label="Max invoices per month"
                type="number"
                min={1}
                max={100000}
                value={limitsData.maxInvoicesPerMonth}
                onChange={(e) => setLimitsData({ ...limitsData, maxInvoicesPerMonth: parseInt(e.target.value, 10) || 1000 })}
              />
              <LoadingButton type="submit" loading={limitsSaving} className="bg-indigo-600 hover:bg-indigo-700">
                Save Limits
              </LoadingButton>
            </form>
          )}
        </div>
      )}

      {/* Modals - REMAKEN */}
      <Modal isOpen={showAddUserModal} onClose={() => setShowAddUserModal(false)} title="Add User to Company" closeOnOverlayClick={false}>
        <form onSubmit={handleAddUser} className="p-6 space-y-5">
          <Input
            label="Full Name"
            placeholder="John Doe"
            icon={<UserIcon className="h-5 w-5" />}
            value={userFormData.name}
            onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            icon={<Mail className="h-5 w-5" />}
            value={userFormData.email}
            onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
            required
          />
          <Input
            label="Initial Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-5 w-5" />}
            value={userFormData.password}
            onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Role"
              value={userFormData.role}
              onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
            >
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </Select>
            <Input
              label="Phone (Optional)"
              placeholder="+971..."
              value={userFormData.phone}
              onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })}
            />
          </div>
          <div className="pt-4">
            <LoadingButton
              type="submit"
              loading={loadingAction}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all"
            >
              Add User
            </LoadingButton>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditUserModal} onClose={() => setShowEditUserModal(false)} title="Edit User Identity" closeOnOverlayClick={false}>
        <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
          <Input
            label="Full Name"
            placeholder="John Doe"
            icon={<UserIcon className="h-5 w-5" />}
            value={userFormData.name}
            onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Role"
              value={userFormData.role}
              onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
            >
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </Select>
            <Input
              label="Phone"
              placeholder="+971..."
              value={userFormData.phone}
              onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })}
            />
          </div>
          <div className="pt-4">
            <LoadingButton
              type="submit"
              loading={loadingAction}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all"
            >
              Save Changes
            </LoadingButton>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Security: Reset Password" closeOnOverlayClick={false}>
        <form onSubmit={handleResetPassword} className="p-6 space-y-5">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start space-x-3 mb-2">
            <Lock className="h-6 w-6 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              Enter a new secure password for <strong>{selectedUser?.name}</strong>. The user will need to use this new password for their next login.
            </p>
          </div>
          <Input
            label="New Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-5 w-5" />}
            value={userFormData.password}
            onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
            required
          />
          <div className="pt-4">
            <LoadingButton
              type="submit"
              loading={loadingAction}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all"
            >
              Update Password
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Company Details"
        size="2xl"
        closeOnOverlayClick={false}
      >
        <form onSubmit={handleUpdateTenant} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Company Display Name"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
            />
            <Input
              label="Company Name (English)"
              value={editFormData.companyNameEn}
              onChange={(e) => setEditFormData({ ...editFormData, companyNameEn: e.target.value })}
            />
            <Input
              label="Company Name (Arabic)"
              value={editFormData.companyNameAr}
              onChange={(e) => setEditFormData({ ...editFormData, companyNameAr: e.target.value })}
            />
            <Input
              label="VAT Number"
              value={editFormData.vatNumber}
              onChange={(e) => setEditFormData({ ...editFormData, vatNumber: e.target.value })}
            />
            <Input
              label="Phone Number"
              value={editFormData.phone}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
            />
            <Select
              label="Status"
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Trial">Trial</option>
              <option value="Suspended">Suspended</option>
              <option value="Expired">Expired</option>
            </Select>
            <Input
              label="Address"
              value={editFormData.address}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={loadingAction}
              className="px-8"
            >
              Save Changes
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Suspend Company Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend Company Access"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex items-start space-x-3">
            <Ban className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-yellow-800">Review Required</h4>
              <p className="text-xs text-yellow-700 leading-relaxed">
                Suspending <strong>{tenant.name}</strong> will block all their users from accessing the system immediately.
              </p>
            </div>
          </div>

          <textarea
            className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none min-h-[100px]"
            placeholder="Reason for suspension (required)..."
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            required
          />

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setShowSuspendModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleSuspend}
              loading={loadingAction}
              disabled={!suspendReason.trim()}
              className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-bold"
            >
              Suspend Now
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Login Lockout Modal */}
      <Modal
        isOpen={showLockoutModal}
        onClose={() => { setShowLockoutModal(false); setLockoutEmail('') }}
        title={lockoutAction === 'unlock' ? 'Unlock Login' : 'Lock Login'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {lockoutAction === 'unlock'
              ? 'Enter the user email to clear failed login attempts and allow them to sign in again.'
              : 'Enter the user email to manually lock their login for the specified duration.'}
          </p>
          <Input
            label="Email"
            type="email"
            value={lockoutEmail}
            onChange={(e) => setLockoutEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          {lockoutAction === 'lock' && (
            <Input
              label="Lock duration (minutes)"
              type="number"
              min={1}
              max={1440}
              value={lockoutDuration}
              onChange={(e) => setLockoutDuration(parseInt(e.target.value, 10) || 15)}
            />
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowLockoutModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <LoadingButton
              loading={loadingAction}
              disabled={!lockoutEmail.trim()}
              onClick={async () => {
                if (!lockoutEmail.trim()) return
                setLoadingAction(true)
                try {
                  const res = lockoutAction === 'unlock'
                    ? await superAdminAPI.unlockLogin(lockoutEmail.trim())
                    : await superAdminAPI.lockLogin(lockoutEmail.trim(), lockoutDuration)
                  if (res?.success) {
                    toast.success(res.message || (lockoutAction === 'unlock' ? 'Login unlocked' : 'Login locked'))
                    setShowLockoutModal(false)
                    setLockoutEmail('')
                  } else {
                    toast.error(res?.message || 'Action failed')
                  }
                } catch (err) {
                  if (!err?._handledByInterceptor) toast.error(err?.response?.data?.message || 'Action failed')
                } finally {
                  setLoadingAction(false)
                }
              }}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              {lockoutAction === 'unlock' ? 'Unlock' : 'Lock'}
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Clear Data Modal - Serious red, double confirmation */}
      <Modal
        isOpen={showClearDataModal}
        onClose={() => {
          setShowClearDataModal(false)
          setClearDataConfirmation('')
          setClearDataCheckbox(false)
        }}
        title="Danger: Reset All Data"
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="space-y-5 border-2 border-red-600 rounded-xl p-1">
          <div className="bg-red-600 p-4 rounded-xl text-white flex items-start space-x-3">
            <Shield className="h-10 w-10 opacity-80 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-lg leading-tight text-white mb-1">Critical: Wipe All Transactional Data</h4>
              <p className="text-sm text-red-100 leading-snug">
                You are about to permanently wipe all transactional data for <strong>{tenant.name}</strong>. This includes all Sales, Purchases, Expenses, and Returns.
              </p>
              <p className="text-sm font-bold text-white mt-2">This action cannot be undone.</p>
            </div>
          </div>

          <div className="space-y-3">
            <ul className="text-xs space-y-2 text-gray-700">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span> Preserved: Users, Products, Customers, Subscription, Company settings</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span> Wiped: Sales, Purchases, Payments, Expenses, Returns; stock and balances reset to 0</li>
              <li className="flex items-center gap-2 font-bold text-red-700"><span className="h-1.5 w-1.5 bg-red-600 rounded-full"></span> IRREVERSIBLE — create a backup first if you may need to restore</li>
            </ul>
          </div>

          <div className="space-y-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clearDataCheckbox}
                onChange={(e) => setClearDataCheckbox(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm font-medium text-red-800">I understand this will permanently delete all transactional data for this company.</span>
            </label>
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Type CLEAR to confirm</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-red-300 rounded-xl bg-white text-red-800 font-bold focus:ring-2 focus:ring-red-400 outline-none transition-all"
                placeholder="CLEAR"
                value={clearDataConfirmation}
                onChange={(e) => setClearDataConfirmation(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowClearDataModal(false)
                setClearDataConfirmation('')
                setClearDataCheckbox(false)
              }}
              className="flex-1 px-4 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all border border-gray-300"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleClearData}
              loading={loadingAction}
              disabled={clearDataConfirmation.trim().toUpperCase() !== 'CLEAR' || !clearDataCheckbox}
              className="flex-2 px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg border-2 border-red-700 disabled:opacity-50 disabled:grayscale transition-all"
            >
              Clear All Data
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Duplicate Data Modal */}
      <Modal
        isOpen={showDuplicateDataModal}
        onClose={() => {
          setShowDuplicateDataModal(false)
          setDuplicatePreview(null)
        }}
        title="Duplicate Data to This Company"
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Copy products and/or settings from another company into <strong>{tenant?.name}</strong>. Existing settings with the same key are skipped.
          </p>
          <Select
            label="Source company"
            value={duplicateSourceTenantId}
            onChange={(e) => setDuplicateSourceTenantId(e.target.value)}
          >
            <option value="">Select a company...</option>
            {tenantsList.filter(t => t.id !== tenant?.id).map(t => (
              <option key={t.id} value={t.id}>{t.name} (ID: {t.id})</option>
            ))}
          </Select>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Data to copy</label>
            <div className="space-y-2">
              {['Products', 'Settings'].map(key => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={duplicateDataTypes[key]}
                    onChange={(e) => setDuplicateDataTypes({ ...duplicateDataTypes, [key]: e.target.checked })}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
          </div>

          {duplicatePreviewLoading && (
            <p className="text-sm text-gray-500">Loading preview…</p>
          )}
          {!duplicatePreviewLoading && duplicatePreview && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Preview</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {duplicateDataTypes.Products && (
                  <li>Will copy <strong>{duplicatePreview.sourceProductsCount ?? 0}</strong> products from source. Target currently has <strong>{duplicatePreview.targetProductsCount ?? 0}</strong> products.</li>
                )}
                {duplicateDataTypes.Settings && (
                  <li>Will copy <strong>{duplicatePreview.sourceSettingsCount ?? 0}</strong> settings (existing keys in target are skipped). Target currently has <strong>{duplicatePreview.targetSettingsCount ?? 0}</strong> settings.</li>
                )}
              </ul>
              {((duplicatePreview.targetProductsCount > 0 && duplicateDataTypes.Products) || (duplicatePreview.targetSettingsCount > 0 && duplicateDataTypes.Settings)) && (
                <p className="text-sm font-medium text-amber-700 mt-2">Target already has data. Products will be added; settings with the same key are skipped.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDuplicateDataModal(false)}
              className="flex-1 px-4 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleDuplicateData}
              loading={loadingAction}
              disabled={!duplicateSourceTenantId || (!duplicateDataTypes.Products && !duplicateDataTypes.Settings)}
              className="flex-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-all"
            >
              Duplicate
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* Subscription Management Modal */}
      <Modal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        title="Administrative Plan Override"
        size="md"
        closeOnOverlayClick={false}
      >
        <form onSubmit={handleUpdateSubscription} className="space-y-5">
          <div className="bg-indigo-600 p-4 rounded-xl text-white flex items-start space-x-3 mb-2">
            <Shield className="h-8 w-8 opacity-80" />
            <div>
              <h4 className="font-bold text-lg leading-tight text-white mb-1">Super Admin Authority</h4>
              <p className="text-xs text-indigo-100 leading-snug">
                You are manually overriding the subscription for <strong>{tenant.name}</strong>. This bypasses the payment gateway.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Select
              label="Select Plan"
              value={subscriptionFormData.planId}
              onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, planId: e.target.value })}
              required
            >
              <option value="">Select a plan...</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(subscriptionFormData.billingCycle === 0 ? plan.monthlyPrice : plan.yearlyPrice, plan.currency)}
                </option>
              ))}
            </Select>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Billing Frequency</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubscriptionFormData({ ...subscriptionFormData, billingCycle: 0 })}
                  className={`py-3 px-4 rounded-xl font-bold border transition-all ${subscriptionFormData.billingCycle === 0
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionFormData({ ...subscriptionFormData, billingCycle: 1 })}
                  className={`py-3 px-4 rounded-xl font-bold border transition-all ${subscriptionFormData.billingCycle === 1
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  Yearly
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowSubscriptionModal(false)}
              className="flex-1 px-4 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={loadingAction}
              className="flex-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition-all"
            >
              Apply Plan
            </LoadingButton>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        isOpen={dangerModal.isOpen}
        title={dangerModal.title}
        message={dangerModal.message}
        confirmLabel={dangerModal.confirmLabel}
        onConfirm={dangerModal.onConfirm}
        onClose={() => setDangerModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

// --- Sub-components ---

const TenantFeaturesTab = ({ tenantId }) => {
  // Feature keys mapping: frontend key -> backend key
  const FEATURE_KEYS = {
    invoicing: 'invoicing',
    pos: 'pos',
    inventory: 'inventory',
    purchases: 'purchases',
    expenses: 'expenses',
    reports: 'reports',
    customers: 'customers',
    multiCurrency: 'multi_currency',
    staffLogin: 'staff_login',  // Critical: controls staff login access
    branchManagement: 'branch_management',
    routeManagement: 'route_management',
    dataImport: 'data_import',
    backup: 'backup',
    salesLedger: 'sales_ledger',
    priceList: 'price_list'
  }

  // Reverse mapping: backend key -> frontend key
  const BACKEND_TO_FRONTEND = Object.fromEntries(
    Object.entries(FEATURE_KEYS).map(([frontend, backend]) => [backend, frontend])
  )

  const [tenantFeatures, setTenantFeatures] = useState({
    invoicing: true,
    pos: true,
    inventory: true,
    purchases: true,
    expenses: true,
    reports: true,
    customers: true,
    multiCurrency: true,
    staffLogin: true,
    branchManagement: true,
    routeManagement: true,
    dataImport: true,
    backup: true,
    salesLedger: true,
    priceList: true
  })
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [featuresSaving, setFeaturesSaving] = useState(false)

  // Define available system features
  const AVAILABLE_FEATURES = [
    { key: 'invoicing', label: 'Invoicing & Billing', description: 'Create and manage invoices, billing cycles', icon: FileText },
    { key: 'pos', label: 'POS System', description: 'Point of sale interface for retail transactions', icon: ShoppingCart },
    { key: 'inventory', label: 'Inventory / Products', description: 'Product management, stock tracking, low stock alerts', icon: Package },
    { key: 'purchases', label: 'Purchases', description: 'Purchase orders, supplier management', icon: TrendingUp },
    { key: 'expenses', label: 'Expenses', description: 'Expense tracking and management', icon: TrendingDown },
    { key: 'reports', label: 'Reports', description: 'Sales reports, profit & loss, analytics', icon: BarChart3 },
    { key: 'customers', label: 'Customers', description: 'Customer management, ledger, credit limits', icon: Users },
    { key: 'multiCurrency', label: 'Multi-Currency', description: 'Support for multiple currencies', icon: DollarSign },
    { key: 'staffLogin', label: 'Staff Logins', description: 'Allow staff users to login (disable to block all staff)', icon: Shield },
    { key: 'branchManagement', label: 'Branch Management', description: 'Multi-branch operations, branch assignments', icon: Building2 },
    { key: 'routeManagement', label: 'Route Management', description: 'Delivery routes, route assignments', icon: MapPin },
    { key: 'dataImport', label: 'Data Import', description: 'Import products, customers, invoices from CSV/Excel', icon: Download },
    { key: 'backup', label: 'Backup', description: 'Data backup and restore functionality', icon: Database },
    { key: 'salesLedger', label: 'Sales Ledger', description: 'Sales ledger and transaction history', icon: BookOpen },
    { key: 'priceList', label: 'Price List', description: 'Price list management and bulk pricing', icon: List }
  ]

  useEffect(() => {
    if (tenantId) {
      fetchFeatures()
    }
  }, [tenantId])

  const fetchFeatures = async () => {
    if (!tenantId) return
    try {
      setFeaturesLoading(true)
      const response = await superAdminAPI.getTenantFeatures(tenantId)
      
      // Backend returns: { success: true, data: { features: ["invoicing", "pos", ...] } }
      // Or API service may return response.data directly
      const responseData = response?.data || response
      const backendFeatures = responseData?.success && responseData?.data?.features
        ? responseData.data.features
        : (responseData?.features || [])
      
      // Convert backend array to frontend object format
      const featuresObj = {
        invoicing: false,
        pos: false,
        inventory: false,
        purchases: false,
        expenses: false,
        reports: false,
        customers: false,
        multiCurrency: false,
        staffLogin: false,
        branchManagement: false,
        routeManagement: false,
        dataImport: false,
        backup: false,
        salesLedger: false,
        priceList: false
      }
      
      // Set enabled features to true
      if (Array.isArray(backendFeatures)) {
        backendFeatures.forEach(backendKey => {
          const frontendKey = BACKEND_TO_FRONTEND[backendKey] || backendKey
          if (featuresObj.hasOwnProperty(frontendKey)) {
            featuresObj[frontendKey] = true
          }
        })
      }
      
      // If no features returned, default to all enabled (for new tenants)
      const hasAnyEnabled = Object.values(featuresObj).some(v => v === true)
      if (!hasAnyEnabled && backendFeatures.length === 0) {
        // New tenant - enable all features by default
        Object.keys(featuresObj).forEach(key => {
          featuresObj[key] = true
        })
      }
      
      setTenantFeatures(featuresObj)
    } catch (err) {
      console.error('Failed to fetch features:', err)
      toast.error(err?.response?.data?.message || 'Could not load features. Please try again.')
      // Keep current state on error (don't reset)
    } finally {
      setFeaturesLoading(false)
    }
  }

  const handleToggleFeature = (featureKey) => {
    setTenantFeatures(prev => ({
      ...prev,
      [featureKey]: !prev[featureKey]
    }))
  }

  const handleSaveFeatures = async () => {
    if (!tenantId) {
      toast.error('Tenant ID is missing')
      return
    }
    
    // Validate feature keys - only allow known keys
    const validKeys = Object.keys(FEATURE_KEYS)
    const invalidKeys = Object.keys(tenantFeatures).filter(key => !validKeys.includes(key))
    if (invalidKeys.length > 0) {
      console.warn('Invalid feature keys detected:', invalidKeys)
      toast.error('Invalid feature configuration. Please refresh and try again.')
      return
    }
    
    try {
      setFeaturesSaving(true)
      await superAdminAPI.updateTenantFeatures(tenantId, tenantFeatures)
      toast.success('Features updated successfully')
    } catch (err) {
      console.error('Failed to update features:', err)
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to save changes. Please try again.'
      toast.error(errorMsg)
      // Reload features to revert to server state
      try {
        await fetchFeatures()
      } catch (reloadErr) {
        console.error('Failed to reload features after save error:', reloadErr)
      }
    } finally {
      setFeaturesSaving(false)
    }
  }

  if (featuresLoading) {
    return (
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8">
        <div className="text-center text-gray-500">Loading features...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Super Admin Only:</strong> These toggles are Super Admin only. Company admin cannot override these settings.
        </div>
      </div>

      {/* Feature toggles */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Sliders className="h-6 w-6 text-indigo-600" />
          Feature Management
        </h2>
        <p className="text-sm text-gray-600 mb-6">Enable or disable specific modules for this tenant.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {AVAILABLE_FEATURES.map((feat) => {
            const Icon = feat.icon
            const isEnabled = tenantFeatures[feat.key]
            return (
              <div
                key={feat.key}
                className={`flex items-start p-4 rounded-lg border transition-all ${isEnabled
                  ? 'border-indigo-200 bg-indigo-50/50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${isEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />}
                    <h4 className={`font-semibold text-sm ${isEnabled ? 'text-indigo-900' : 'text-gray-700'}`}>
                      {feat.label}
                    </h4>
                    {isEnabled && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{feat.description}</p>
                </div>
                <button
                  onClick={() => handleToggleFeature(feat.key)}
                  disabled={featuresSaving}
                  className={`relative ml-3 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isEnabled ? 'bg-indigo-600 focus:ring-indigo-500' : 'bg-gray-200 focus:ring-gray-500'
                    } ${featuresSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            )
          })}
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <LoadingButton
            onClick={handleSaveFeatures}
            loading={featuresSaving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
          >
            Save Changes
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminTenantDetailPage

