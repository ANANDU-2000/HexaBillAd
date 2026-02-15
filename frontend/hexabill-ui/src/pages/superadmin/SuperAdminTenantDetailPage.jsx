import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  ShoppingCart,
  Receipt,
  BarChart3,
  List,
  Wallet,
  Settings,
  History,
  TrendingUp,
  CreditCard,
  UserPlus,
  Shield,
  CheckCircle2,
  RefreshCw,
  Lock,
  User as UserIcon,
  Copy
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { Input, Select } from '../../components/Form'

const SuperAdminTenantDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
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
  const [suspendReason, setSuspendReason] = useState('')
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    planId: '',
    billingCycle: 0 // 0 = Monthly, 1 = Yearly
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    companyNameEn: '',
    companyNameAr: '',
    email: '',
    phone: '',
    country: 'AE',
    currency: 'AED',
    vatNumber: '',
    address: '',
    status: 'Active'
  })

  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    phone: ''
  })

  useEffect(() => {
    if (id) {
      fetchTenant()
      fetchPlans()
    }
  }, [id])

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

  const fetchTenant = async () => {
    try {
      setLoading(true)
      const response = await superAdminAPI.getTenant(parseInt(id))
      if (response.success) {
        setTenant(response.data)
      } else {
        toast.error(response.message || 'Failed to load company')
        navigate('/superadmin/tenants')
      }
    } catch (error) {
      console.error('Error loading tenant:', error)
      toast.error('Failed to load company')
      navigate('/superadmin/tenants')
    } finally {
      setLoading(false)
    }
  }

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
      toast.error('Failed to suspend company')
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
      toast.error('Failed to activate company')
    }
  }

  const handleEnterWorkspace = () => {
    if (!tenant) return
    localStorage.setItem('selected_tenant_id', tenant.id)
    localStorage.setItem('selected_tenant_name', tenant.name)
    toast.success(`Entering ${tenant.name}'s workspace`)
    window.location.href = '/dashboard'
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
      toast.error('An error occurred while clearing data')
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
        toast.error('Failed to load companies list')
        return
      }
    }
    setDuplicateSourceTenantId('')
    setDuplicateDataTypes({ Products: true, Settings: true })
    setShowDuplicateDataModal(true)
  }

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
      toast.error(error?.response?.data?.message || 'An error occurred')
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
      toast.error('An error occurred while updating subscription')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
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
      toast.error(error.response?.data?.message || 'Failed to add user')
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
      toast.error(error.response?.data?.message || 'Failed to update user')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await superAdminAPI.deleteTenantUser(tenant.id, userId)
      if (response.success) {
        toast.success('User deleted successfully')
        fetchTenant()
      } else {
        toast.error(response.message || 'Failed to delete user')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user')
    }
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
      toast.error(error.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoadingAction(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase()
    const badges = {
      active: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Active</span>,
      trial: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>,
      suspended: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Suspended</span>,
      expired: <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Expired</span>
    }
    return badges[statusLower] || <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingCard />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-4">
          <p className="text-red-800">Company not found</p>
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
            <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
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
            {getStatusBadge(tenant.status)}
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 font-bold">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'users', 'subscription', 'usage', 'reports'].map((tab) => (
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

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-lg border border-red-100 shadow-sm p-6 mt-6">
            <h2 className="text-xl font-bold text-red-800 mb-4">Danger Zone</h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">Reset Database</h3>
                <p className="text-sm text-red-700 mt-1">
                  Wipe all transactions, sales, and expenses. This keeps products and customers but resets their stock/balances.
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
                        <button onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }} className="text-green-600 hover:text-green-900"><CheckCircle2 className="h-4 w-4" /></button>
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
                  onClick={() => {
                    localStorage.setItem('selected_tenant_id', tenant.id)
                    localStorage.setItem('selected_tenant_name', tenant.name)
                    toast.success(`Opening ${report.label} for ${tenant.name}...`)
                    // Use window.location.href to ensure a clean state transition with new tenant context
                    window.location.href = report.path
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
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span> Users, Products, and Customers are kept</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span> Stock quantities and balances reset to 0</li>
              <li className="flex items-center gap-2 font-bold text-red-700"><span className="h-1.5 w-1.5 bg-red-600 rounded-full"></span> IRREVERSIBLE — no backup is created here</li>
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
        onClose={() => setShowDuplicateDataModal(false)}
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
    </div>
  )
}

export default SuperAdminTenantDetailPage

