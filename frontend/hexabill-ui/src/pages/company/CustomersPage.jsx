import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Download,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Filter,
  RefreshCw,
  Users,
  AlertCircle,
  UserPlus,
  DollarSign,
  Inbox
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatBalance, formatBalanceWithColor } from '../../utils/currency'
import { isAdminOrOwner } from '../../utils/roles'  // CRITICAL: Multi-tenant role checking
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select, TextArea } from '../../components/Form'
import Modal from '../../components/Modal'
import { customersAPI } from '../../services'
import { TabNavigation } from '../../components/ui'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

const CustomersPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledgerData, setLedgerData] = useState([])
  const [saving, setSaving] = useState(false)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm()

  useEffect(() => {
    fetchCustomers()
    // Auto-refresh DISABLED - prevents UI interruption during user actions
    // User can manually refresh with refresh button
  }, [])

  // Handle ?edit=ID URL parameter from Customer Ledger
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId && customers.length > 0) {
      const customerToEdit = customers.find(c => c.id === parseInt(editId))
      if (customerToEdit) {
        handleEdit(customerToEdit)
        // Remove the edit parameter from URL after opening modal
        setSearchParams({})
      } else {
        // Customer not found - show error and remove param
        console.error(`Customer with ID ${editId} not found`)
        toast.error(`Customer with ID ${editId} not found. Showing all customers.`)
        setSearchParams({})
      }
    } else if (editId && !loading && customers.length === 0) {
      // Customers loaded but empty - customer doesn't exist
      toast.error(`Customer with ID ${editId} not found.`)
      setSearchParams({})
    }
  }, [customers, searchParams, loading, setSearchParams])

  useEffect(() => {
    filterCustomers()
  }, [customers, debouncedSearchTerm, activeTab])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // Fetch all customers (filter client-side for better tab filtering)
      const response = await customersAPI.getCustomers({ page: 1, pageSize: 100 })
      if (response.success && response.data) {
        setCustomers(response.data.items || [])
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      // Only show error if it's not a network error (handled by interceptor)
      if (error.response || (!error.code || error.code !== 'ERR_NETWORK')) {
      toast.error(error?.response?.data?.message || 'Failed to load customers')
      }
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const filterCustomers = () => {
    let filtered = customers

    // Apply tab filter
    if (activeTab === 'outstanding') {
      filtered = filtered.filter(c => (c.balance || 0) > 0)
    } else if (activeTab === 'active') {
      filtered = filtered.filter(c => (c.balance || 0) <= 0 && (c.balance || 0) >= -100) // Active: zero or small credit
    } else if (activeTab === 'inactive') {
      // Inactive: customers with no recent activity or very old balance
      filtered = filtered.filter(c => {
        const balance = c.balance || 0
        return Math.abs(balance) < 0.01 // Zero balance (inactive)
      })
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        customer.phone?.includes(debouncedSearchTerm) ||
        customer.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        customer.trn?.includes(debouncedSearchTerm)
      )
    }

    setFilteredCustomers(filtered)
  }

  const onSubmit = async (data) => {
    if (saving) {
      toast.error('Please wait, operation in progress...')
      return
    }

    try {
      setSaving(true)
      let response
      if (selectedCustomer) {
        response = await customersAPI.updateCustomer(selectedCustomer.id, data)
      } else {
        response = await customersAPI.createCustomer(data)
      }
      
      if (response.success) {
        toast.success(selectedCustomer ? 'Customer updated successfully!' : 'Customer added successfully!')
        // Refresh customer list without page reload
        await fetchCustomers()
        reset()
        setShowAddModal(false)
        setShowEditModal(false)
        setSelectedCustomer(null)
      } else {
        toast.error(response.message || 'Failed to save customer')
      }
    } catch (error) {
      console.error('Failed to save customer:', error)
      toast.error(error?.response?.data?.message || 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (customer) => {
    setSelectedCustomer(customer)
    setValue('name', customer.name)
    setValue('phone', customer.phone)
    setValue('email', customer.email)
    setValue('trn', customer.trn)
    setValue('address', customer.address)
    setValue('creditLimit', customer.creditLimit)
    setValue('customerType', customer.customerType || 'Credit')
    setShowEditModal(true)
  }

  const handleDelete = async (customerId) => {
    const customer = customers.find(c => c.id === customerId)
    const customerName = customer?.name || 'Customer'
    
    // First check if customer has transactions
    const hasTransactions = (customer?.balance || 0) !== 0
    
    let confirmMessage = ''
    let forceDelete = false
    
    if (hasTransactions) {
      // Customer has transactions - offer force delete option
      confirmMessage = `WARNING: This customer has transactions.\n\n` +
        `Force Delete will permanently delete:\n` +
        `• Customer: ${customerName}\n` +
        `• All Sales/Invoices\n` +
        `• All Payments\n` +
        `• All Sale Returns\n` +
        `• Stock will be restored\n\n` +
        `THIS CANNOT BE UNDONE!\n\n` +
        `Type "DELETE ${customerName.toUpperCase()}" to confirm:`
      
      const confirmText = prompt(confirmMessage)
      if (confirmText?.trim().toUpperCase() !== `DELETE ${customerName.toUpperCase()}`) {
        if (confirmText !== null) {
          toast.error('Deletion cancelled. You must type the exact confirmation text.')
        }
        return
      }
      forceDelete = true
    } else {
      // No transactions - regular delete
      confirmMessage = `WARNING: Are you sure you want to delete "${customerName}"?\n\nThis action cannot be undone!`
      if (!window.confirm(confirmMessage)) return
    }
    
    try {
      const response = await customersAPI.deleteCustomer(customerId, forceDelete)
      if (response.success) {
        const summary = response.data
        if (forceDelete && summary) {
          toast.success(
            `Customer "${customerName}" and all data deleted!\n` +
            `Deleted: ${summary.salesDeleted} sales, ${summary.paymentsDeleted} payments, ${summary.saleReturnsDeleted} returns.` +
            (summary.stockRestored ? ' Stock restored.' : ''),
            { duration: 5000 }
          )
        } else {
          toast.success('Customer deleted successfully!')
        }
        // Update state directly without full page reload
        setCustomers(prev => prev.filter(c => c.id !== customerId))
        setFilteredCustomers(prev => prev.filter(c => c.id !== customerId))
      } else {
        toast.error(response.message || 'Failed to delete customer')
      }
    } catch (error) {
      console.error('Failed to delete customer:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const handleViewLedger = async (customer) => {
    setSelectedCustomer(customer)
    try {
      const response = await customersAPI.getCustomerLedger(customer.id)
      if (response.success) {
        setLedgerData(response.data || [])
      }
      setShowLedgerModal(true)
    } catch (error) {
      toast.error('Failed to load ledger data')
      setShowLedgerModal(true)
    }
  }

  const handleRecalculateBalance = async (customerId) => {
    try {
      toast.loading('Recalculating balance...')
      const response = await customersAPI.recalculateBalance(customerId)
      if (response.success) {
        toast.success('Balance recalculated successfully!')
        fetchCustomers() // Refresh customer list
      } else {
        toast.error(response.message || 'Failed to recalculate balance')
      }
    } catch (error) {
      console.error('Failed to recalculate balance:', error)
      toast.error(error?.response?.data?.message || 'Failed to recalculate balance')
    }
  }

  const handleExportStatement = async () => {
    if (!selectedCustomer) return
    
    try {
      toast.loading('Generating statement PDF...')
      const blob = await customersAPI.getCustomerStatement(selectedCustomer.id)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer_statement_${selectedCustomer.id}_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Statement exported successfully!')
    } catch (error) {
      console.error('Failed to export statement:', error)
      toast.error('Failed to export statement')
    }
  }

  const handleShareWhatsApp = () => {
    const message = `Customer Statement for ${selectedCustomer?.name}\n\nPlease find attached the statement for the period.`
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const tabs = [
    { id: 'all', label: 'All Customers', icon: Users },
    { id: 'active', label: 'Active', icon: UserPlus },
    { id: 'outstanding', label: 'Outstanding', icon: AlertCircle, badge: customers.filter(c => (c.balance || 0) > 0).length },
    { id: 'inactive', label: 'Inactive', icon: Users }
  ]

  if (loading) {
    return <LoadingCard message="Loading customers..." />
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Modern Header - Responsive */}
      <div className="bg-white border-b border-gray-200 shadow-sm -mx-6 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage customer information and accounts</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => fetchCustomers()}
              className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg shadow-sm text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-transparent rounded-lg shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 min-h-[44px]"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Add Customer
            </button>
          </div>
        </div>

        {/* Modern Tabs */}
        <div className="mt-4">
          <TabNavigation 
            tabs={tabs} 
            activeTab={activeTab} 
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <Select
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              className="w-32"
            />
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table - Responsive */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit Limit
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Order
                </th>
                <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 sm:px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Inbox className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-gray-500 text-sm font-medium">No customers found</p>
                      <p className="text-gray-500 text-xs mt-1">Try adjusting your search or filters</p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Customer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.trn}</div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900">{customer.phone}</div>
                    <div className="text-xs text-gray-500">{customer.email}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {formatCurrency(customer.creditLimit)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`text-xs sm:text-sm font-medium ${
                      customer.balance < 0 ? 'text-green-600' : customer.balance > 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {formatBalance(customer.balance)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {customer.lastOrderDate || 'No orders'}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => handleViewLedger(customer)}
                        className="bg-blue-50 text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-300 p-1.5 sm:p-2 rounded transition-colors shadow-sm flex items-center gap-1"
                        title="View Ledger"
                        aria-label="View Ledger"
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline text-xs font-medium">View</span>
                      </button>
                      <button
                        onClick={() => handleEdit(customer)}
                        className="bg-indigo-50 text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-300 p-1.5 sm:p-2 rounded transition-colors shadow-sm flex items-center gap-1"
                        title="Edit Customer"
                        aria-label="Edit Customer"
                      >
                        <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline text-xs font-medium">Edit</span>
                      </button>
                      {isAdminOrOwner(user) && (
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 p-1.5 sm:p-2 rounded transition-colors shadow-sm flex items-center gap-1"
                          title="Delete Customer (Admin Only)"
                          aria-label="Delete Customer (Admin Only)"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline text-xs font-medium">Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{customer.phone}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleViewLedger(customer)}
                    className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-300 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    title="View Ledger"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(customer)}
                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-300 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    title="Edit Customer"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {user?.role?.toLowerCase() === 'admin' && (
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="bg-red-50 text-red-600 hover:text-white hover:bg-red-600 border border-red-300 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      title="Delete Customer (Admin Only)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Balance:</span>
                  <span className={`ml-1 font-medium ${
                    customer.balance < 0 ? 'text-green-600' : customer.balance > 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {formatBalance(customer.balance)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Limit:</span>
                  <span className="ml-1">{formatCurrency(customer.creditLimit)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          reset()
          setSaving(false)
        }}
        title="Add New Customer"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Customer Name"
              placeholder="ABC Restaurant"
              required
              error={errors.name?.message}
              {...register('name', { required: 'Customer name is required' })}
            />

            <Input
              label="Phone Number"
              placeholder="+971 50 123 4567"
              required
              error={errors.phone?.message}
              {...register('phone', { required: 'Phone number is required' })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="info@abcrestaurant.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="TRN Number"
              placeholder="TRN123456789"
              error={errors.trn?.message}
              {...register('trn')}
            />

            <Input
              label="Credit Limit"
              type="number"
              placeholder="50000"
              error={errors.creditLimit?.message}
              {...register('creditLimit', { 
                valueAsNumber: true,
                min: { value: 0, message: 'Credit limit must be positive' }
              })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
              <select
                {...register('customerType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Credit">Credit (Can have outstanding balance)</option>
                <option value="Cash">Cash (Must pay immediately)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Credit customers can have outstanding balance, Cash customers must pay immediately</p>
            </div>

            <div className="md:col-span-2">
              <TextArea
                label="Address"
                placeholder="Dubai Marina, Dubai, UAE"
                rows={3}
                error={errors.address?.message}
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false)
                reset()
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={saving}>
              Add Customer
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedCustomer(null)
          reset()
          setSaving(false)
        }}
        title="Edit Customer"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Customer Name"
              placeholder="ABC Restaurant"
              required
              error={errors.name?.message}
              {...register('name', { required: 'Customer name is required' })}
            />

            <Input
              label="Phone Number"
              placeholder="+971 50 123 4567"
              required
              error={errors.phone?.message}
              {...register('phone', { required: 'Phone number is required' })}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="info@abcrestaurant.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="TRN Number"
              placeholder="TRN123456789"
              error={errors.trn?.message}
              {...register('trn')}
            />

            <Input
              label="Credit Limit"
              type="number"
              placeholder="50000"
              error={errors.creditLimit?.message}
              {...register('creditLimit', { 
                valueAsNumber: true,
                min: { value: 0, message: 'Credit limit must be positive' }
              })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
              <select
                {...register('customerType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Credit">Credit (Can have outstanding balance)</option>
                <option value="Cash">Cash (Must pay immediately)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Credit customers can have outstanding balance, Cash customers must pay immediately</p>
            </div>

            <div className="md:col-span-2">
              <TextArea
                label="Address"
                placeholder="Dubai Marina, Dubai, UAE"
                rows={3}
                error={errors.address?.message}
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setSelectedCustomer(null)
                reset()
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <LoadingButton type="submit" loading={saving}>
              Update Customer
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Customer Ledger Modal */}
      <Modal
        isOpen={showLedgerModal}
        onClose={() => {
          setShowLedgerModal(false)
          setSelectedCustomer(null)
        }}
        title={`Customer Ledger - ${selectedCustomer?.name}`}
        size="xl"
        allowFullscreen={true}
      >
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Current Balance</p>
                <p className={`text-lg font-semibold ${
                  selectedCustomer?.balance < 0 ? 'text-green-600' : selectedCustomer?.balance > 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {formatBalance(selectedCustomer?.balance || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Credit Limit</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(selectedCustomer?.creditLimit || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Available Credit</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency((selectedCustomer?.creditLimit || 0) - (selectedCustomer?.balance || 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={() => {
                // Use React Router navigation instead of full page reload
                navigate(`/ledger?customerId=${selectedCustomer?.id}`)
                setShowLedgerModal(false)
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Open Ledger
            </button>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.date).toLocaleDateString('en-GB')}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.reference}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      entry.balance < 0 ? 'text-green-600' : entry.balance > 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatBalance(entry.balance)}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Phone className="h-4 w-4 mr-2" />
              Share via WhatsApp
            </button>
            <button
              onClick={handleExportStatement}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Statement
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CustomersPage
