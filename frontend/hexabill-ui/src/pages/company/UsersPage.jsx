import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  ShieldAlert,
  User,
  Mail,
  Phone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  ShoppingCart,
  TrendingUp,
  BookOpen,
  Wallet,
  BarChart3,
  Activity,
  Package,
  Zap,
  FileText
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingCard } from '../../components/Loading'
import Modal from '../../components/Modal'
import { adminAPI, branchesAPI, routesAPI } from '../../services'
import toast from 'react-hot-toast'
import { isAdminOrOwner, isOwner, getRoleDisplayName } from '../../utils/roles'  // CRITICAL: Multi-tenant role checking

const DASHBOARD_ITEMS = [
  { id: 'salesToday', label: 'Sales Today Card', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'expensesToday', label: 'Expenses Today Card', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'purchasesToday', label: 'Purchases Today Card', icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'profitToday', label: 'Profit Today Card', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', note: 'Admin/Owner only' },
  { id: 'salesLedger', label: 'Sales Ledger Link', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'expenses', label: 'Expenses Link', icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'salesTrend', label: 'Sales Trend Chart', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'quickStats', label: 'Quick Stats Summary', icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { id: 'lowStockAlert', label: 'Low Stock Alerts', icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'quickActions', label: 'Quick Actions', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'pendingBills', label: 'Pending Bills Table', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50' }
]

const DashboardAccessControl = ({ selectedPermissions, onToggle, onSelectAll, onClearAll }) => (
  <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-blue-900 flex items-center">
        <Shield className="h-4 w-4 mr-1.5" />
        Dashboard access
      </h3>
      <div className="flex space-x-2">
        <button type="button" onClick={onSelectAll} className="text-xs font-medium text-blue-600 hover:text-blue-800">All</button>
        <span className="text-blue-200">|</span>
        <button type="button" onClick={onClearAll} className="text-xs font-medium text-blue-600 hover:text-blue-800">None</button>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
      {DASHBOARD_ITEMS.map(item => {
        const Icon = item.icon
        const isSelected = selectedPermissions.includes(item.id)
        return (
          <label
            key={item.id}
            className={`flex items-center p-2 rounded-lg cursor-pointer transition-all border ${isSelected
              ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100'
              : 'bg-white/40 border-transparent opacity-70 hover:bg-white hover:opacity-100'
              }`}
          >
            <div className="relative flex items-center w-full">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all cursor-pointer"
              />
              <div className={`ml-3 p-1.5 rounded-md ${item.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
              </div>
              <div className="ml-2 flex flex-col">
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                {item.note && <span className="text-xs text-gray-500 italic font-normal leading-none">{item.note}</span>}
              </div>
            </div>
          </label>
        )
      })}
    </div>
  </div>
)

const UserAssignments = ({ branches, routes, assignedBranches, assignedRoutes, setAssignedBranches, setAssignedRoutes }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="bg-white p-3 rounded-lg border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
        Assigned Branches
      </h3>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {branches.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No branches found.</p>
        ) : (
          branches.map(branch => (
            <label key={branch.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={assignedBranches.includes(branch.id)}
                onChange={(e) => {
                  if (e.target.checked) setAssignedBranches([...assignedBranches, branch.id])
                  else setAssignedBranches(assignedBranches.filter(id => id !== branch.id))
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{branch.name}</span>
            </label>
          ))
        )}
      </div>
    </div>

    <div className="bg-white p-3 rounded-lg border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
        <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
        Assigned Routes
      </h3>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {routes.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No routes found.</p>
        ) : (
          routes.map(route => (
            <label key={route.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={assignedRoutes.includes(route.id)}
                onChange={(e) => {
                  if (e.target.checked) setAssignedRoutes([...assignedRoutes, route.id])
                  else setAssignedRoutes(assignedRoutes.filter(id => id !== route.id))
                }}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex flex-col">
                <span className="text-sm text-gray-700">{route.name}</span>
                <span className="text-xs text-gray-500">{branches.find(b => b.id === route.branchId)?.name}</span>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  </div>
)

const UsersPage = () => {
  const { user: currentUser, updateUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [loadingAction, setLoadingAction] = useState(false)

  const [userModalTab, setUserModalTab] = useState('details') // 'details' | 'access' | 'assignments'
  const [branches, setBranches] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignedBranches, setAssignedBranches] = useState([])
  const [assignedRoutes, setAssignedRoutes] = useState([])

  // Dashboard permissions state
  const [selectedPermissions, setSelectedPermissions] = useState(
    DASHBOARD_ITEMS.map(i => i.id) // Default all on
  )

  const togglePermission = (id) => {
    setSelectedPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const selectAllPermissions = () => {
    setSelectedPermissions(DASHBOARD_ITEMS.map(i => i.id))
  }

  const clearAllPermissions = () => {
    setSelectedPermissions([])
  }

  const openAddModal = () => {
    setUserModalTab('details')
    resetAdd()
    setSelectedPermissions(DASHBOARD_ITEMS.map(i => i.id))
    setAssignedBranches([])
    setAssignedRoutes([])
    fetchBranchesAndRoutes()
    setShowAddModal(true)
  }

  const fetchBranchesAndRoutes = async () => {
    try {
      const [branchesRes, routesRes] = await Promise.all([
        branchesAPI.getBranches(),
        routesAPI.getRoutes()
      ])
      if (branchesRes?.success) setBranches(branchesRes.data || [])
      if (routesRes?.success) setRoutes(routesRes.data || [])
    } catch (error) {
      console.error('Error loading assignments data:', error)
    }
  }

  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    formState: { errors: errorsAdd }
  } = useForm()

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
    setValue: setEditValue
  } = useForm()

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: errorsPassword }
  } = useForm()

  useEffect(() => {
    if (isAdminOrOwner(currentUser)) {
      fetchUsers()
    }
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getUsers()
      if (response?.success && response?.data) {
        setUsers(response.data.items || [])
      } else {
        setUsers([])
      }
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users)
      return
    }

    const filtered = users.filter(user =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredUsers(filtered)
  }

  const handleCreateUser = async (data) => {
    try {
      setLoadingAction(true)
      const payload = {
        ...data,
        dashboardPermissions: selectedPermissions.join(','),
        assignedBranchIds: assignedBranches,
        assignedRouteIds: assignedRoutes
      }
      const response = await adminAPI.createUser(payload)
      if (response?.success) {
        toast.success('User created successfully!')
        setShowAddModal(false)
        resetAdd()
        fetchUsers()
      } else {
        toast.error(response?.message || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(error?.response?.data?.message || 'Failed to create user')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleUpdateUser = async (data) => {
    try {
      setLoadingAction(true)
      const payload = {
        ...data,
        dashboardPermissions: selectedPermissions.join(','),
        assignedBranchIds: assignedBranches,
        assignedRouteIds: assignedRoutes
      }
      const response = await adminAPI.updateUser(selectedUser.id, payload)
      if (response?.success) {
        toast.success('User updated successfully!')
        // If updating self, update local state immediately
        if (selectedUser.id === currentUser?.id || selectedUser.id === currentUser?.UserId) {
          updateUser({ dashboardPermissions: payload.dashboardPermissions })
        }
        setShowEditModal(false)
        resetEdit()
        setSelectedUser(null)
        fetchUsers()
      } else {
        toast.error(response?.message || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error(error?.response?.data?.message || 'Failed to update user')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleResetPassword = async (data) => {
    try {
      setLoadingAction(true)
      const response = await adminAPI.resetPassword(selectedUser.id, data)
      if (response?.success) {
        toast.success('Password reset successfully!')
        setShowPasswordModal(false)
        resetPassword()
        setSelectedUser(null)
      } else {
        toast.error(response?.message || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error(error?.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoadingAction(false)
    }
  }

  const openEditModal = (user) => {
    setUserModalTab('details')
    setSelectedUser(user)
    setEditValue('name', user.name)
    setEditValue('phone', user.phone || '')
    setEditValue('role', user.role)

    // Set dashboard permissions from user
    if (user.dashboardPermissions) {
      setSelectedPermissions(user.dashboardPermissions.split(','))
    } else {
      setSelectedPermissions(DASHBOARD_ITEMS.map(i => i.id))
    }

    setShowEditModal(true)

    // Load assignments
    fetchBranchesAndRoutes()
    setAssignedBranches(user.assignedBranchIds || [])
    setAssignedRoutes(user.assignedRouteIds || [])
  }

  const openPasswordModal = (user) => {
    setSelectedUser(user)
    setShowPasswordModal(true)
  }

  if (!isAdminOrOwner(currentUser)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators and owners can access this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingCard message="Loading users..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <User className="h-6 w-6 mr-2 text-blue-600" />
              User Management
            </h1>
            <p className="text-gray-600">Manage admin and staff users</p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-sm">
                      {searchTerm ? 'No users found matching your search' : 'No users found. Add your first user.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.role?.toLowerCase() === 'owner' ? (
                            <ShieldAlert className="h-5 w-5 text-red-600 mr-2" />
                          ) : user.role?.toLowerCase() === 'admin' ? (
                            <Shield className="h-5 w-5 text-yellow-500 mr-2" />
                          ) : (
                            <User className="h-5 w-5 text-blue-500 mr-2" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-4 w-4 mr-2" />
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${user.role?.toLowerCase() === 'owner'
                            ? 'bg-red-100 text-red-800'
                            : user.role?.toLowerCase() === 'admin'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                            }`}>
                            {getRoleDisplayName(user)}
                          </span>
                          {user.role?.toLowerCase() === 'owner' && (
                            <span className="text-xs text-gray-500">Company owner</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {(isOwner(currentUser) || user.role?.toLowerCase() !== 'owner') && (
                            <button
                              onClick={() => openEditModal(user)}
                              className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition"
                              title="Edit User"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                          )}
                          {(isOwner(currentUser) || user.role?.toLowerCase() !== 'owner') && (
                            <button
                              onClick={() => openPasswordModal(user)}
                              className="text-green-600 hover:text-green-900 p-2 hover:bg-green-50 rounded transition"
                              title="Reset Password"
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role?.toLowerCase() === 'admin').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Staff</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role?.toLowerCase() === 'staff').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal - tabbed for shorter vertical layout */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          resetAdd()
        }}
        title="Add User"
      >
        <form onSubmit={handleSubmitAdd(handleCreateUser)} className="flex flex-col max-h-[85vh]">
          <div className="flex border-b border-gray-200 mb-3">
            <button
              type="button"
              onClick={() => setUserModalTab('details')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setUserModalTab('access')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'access' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Dashboard access
            </button>
            <button
              type="button"
              onClick={() => setUserModalTab('assignments')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'assignments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Assignments
            </button>
          </div>
          <div className="overflow-y-auto min-h-0 flex-1 space-y-3">
            {userModalTab === 'details' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Name *</label>
                  <input
                    type="text"
                    {...registerAdd('name', { required: 'Name is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {errorsAdd.name && <p className="text-red-500 text-xs mt-0.5">{errorsAdd.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Email *</label>
                  <input
                    type="email"
                    {...registerAdd('email', { required: 'Email is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {errorsAdd.email && <p className="text-red-500 text-xs mt-0.5">{errorsAdd.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Password *</label>
                  <input
                    type="password"
                    {...registerAdd('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'At least 6 characters' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {errorsAdd.password && <p className="text-red-500 text-xs mt-0.5">{errorsAdd.password.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Role *</label>
                  <select
                    {...registerAdd('role', { required: 'Role is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select role</option>
                    {isOwner(currentUser) && <option value="Owner">Owner</option>}
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                  {errorsAdd.role && <p className="text-red-500 text-xs mt-0.5">{errorsAdd.role.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Phone</label>
                  <input
                    type="text"
                    {...registerAdd('phone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </>
            )}
            {userModalTab === 'access' && (
              <DashboardAccessControl
                selectedPermissions={selectedPermissions}
                onToggle={togglePermission}
                onSelectAll={selectAllPermissions}
                onClearAll={clearAllPermissions}
              />
            )}
            {userModalTab === 'assignments' && (
              <UserAssignments
                branches={branches}
                routes={routes}
                assignedBranches={assignedBranches}
                assignedRoutes={assignedRoutes}
                setAssignedBranches={setAssignedBranches}
                setAssignedRoutes={setAssignedRoutes}
              />
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-3 mt-3 border-t border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); resetAdd(); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loadingAction}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              disabled={loadingAction}
            >
              {loadingAction ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal - tabbed */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          resetEdit()
          setSelectedUser(null)
        }}
        title="Edit User"
      >
        <form onSubmit={handleSubmitEdit(handleUpdateUser)} className="flex flex-col max-h-[85vh]">
          <div className="flex border-b border-gray-200 mb-3">
            <button
              type="button"
              onClick={() => setUserModalTab('details')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setUserModalTab('access')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'access' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Dashboard access
            </button>
            <button
              type="button"
              onClick={() => setUserModalTab('assignments')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${userModalTab === 'assignments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Assignments
            </button>
          </div>
          <div className="overflow-y-auto min-h-0 flex-1 space-y-3">
            {userModalTab === 'details' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Name *</label>
                  <input
                    type="text"
                    {...registerEdit('name', { required: 'Name is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {errorsEdit.name && <p className="text-red-500 text-xs mt-0.5">{errorsEdit.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Email</label>
                  <input
                    type="email"
                    value={selectedUser?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Role *</label>
                  <select
                    {...registerEdit('role', { required: 'Role is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select role</option>
                    {isOwner(currentUser) && <option value="Owner">Owner</option>}
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                  {errorsEdit.role && <p className="text-red-500 text-xs mt-0.5">{errorsEdit.role.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Phone</label>
                  <input
                    type="text"
                    {...registerEdit('phone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </>
            )}
            {userModalTab === 'access' && (
              <DashboardAccessControl
                selectedPermissions={selectedPermissions}
                onToggle={togglePermission}
                onSelectAll={selectAllPermissions}
                onClearAll={clearAllPermissions}
              />
            )}
            {userModalTab === 'assignments' && (
              <UserAssignments
                branches={branches}
                routes={routes}
                assignedBranches={assignedBranches}
                assignedRoutes={assignedRoutes}
                setAssignedBranches={setAssignedBranches}
                setAssignedRoutes={setAssignedRoutes}
              />
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-3 mt-3 border-t border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => { setShowEditModal(false); resetEdit(); setSelectedUser(null); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loadingAction}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              disabled={loadingAction}
            >
              {loadingAction ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          resetPassword()
          setSelectedUser(null)
        }}
        title="Reset Password"
      >
        <form onSubmit={handleSubmitPassword(handleResetPassword)} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              Reset password for <strong>{selectedUser?.name}</strong> ({selectedUser?.email})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <input
              type="password"
              {...registerPassword('newPassword', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errorsPassword.newPassword && <p className="text-red-500 text-xs mt-1">{errorsPassword.newPassword.message}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false)
                resetPassword()
                setSelectedUser(null)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loadingAction}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              disabled={loadingAction}
            >
              {loadingAction ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UsersPage


