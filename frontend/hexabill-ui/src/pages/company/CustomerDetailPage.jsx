import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Mail, Phone, MapPin, DollarSign, Calendar, FileText, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { formatCurrency, formatBalance } from '../../utils/currency'
import toast from 'react-hot-toast'
import { customersAPI } from '../../services'
import { LoadingCard } from '../../components/Loading'

const CustomerDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadCustomer()
      loadLedger()
    }
  }, [id])

  const loadCustomer = async () => {
    try {
      setLoading(true)
      const response = await customersAPI.getCustomer(id)
      if (response.success && response.data) {
        setCustomer(response.data)
      } else {
        toast.error('Customer not found')
        navigate('/customers')
      }
    } catch (error) {
      console.error('Failed to load customer:', error)
      toast.error('Failed to load customer')
      navigate('/customers')
    } finally {
      setLoading(false)
    }
  }

  const loadLedger = async () => {
    try {
      setLedgerLoading(true)
      const response = await customersAPI.getCustomerLedger(id, {})
      if (response.success && response.data) {
        setLedger(response.data || [])
      } else {
        setLedger([])
      }
    } catch (error) {
      console.error('Failed to load ledger:', error)
      setLedger([])
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleSendStatement = async () => {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 30) // Last 30 days
      const toDate = new Date()
      const blob = await customersAPI.getCustomerStatement(id, fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer_statement_${id}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Statement downloaded successfully')
    } catch (error) {
      console.error('Failed to download statement:', error)
      toast.error('Failed to download statement')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingCard />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">Customer not found</p>
          <Link to="/customers" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Customers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500">Customer Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/customers?edit=${customer.id}`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button
            onClick={handleSendStatement}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Statement
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-500">Phone</label>
            <div className="mt-1 flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">{customer.phone || 'N/A'}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <div className="mt-1 flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">{customer.email || 'N/A'}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">TRN</label>
            <div className="mt-1 text-sm text-gray-900">{customer.trn || 'N/A'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Address</label>
            <div className="mt-1 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">{customer.address || 'N/A'}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Customer Type</label>
            <div className="mt-1 text-sm text-gray-900">{customer.customerType || 'Credit'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Payment Terms</label>
            <div className="mt-1 text-sm text-gray-900">{customer.paymentTerms || 'N/A'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Credit Limit</label>
            <div className="mt-1 text-sm text-gray-900">{formatCurrency(customer.creditLimit || 0)}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Last Activity</label>
            <div className="mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">
                {customer.lastActivity ? new Date(customer.lastActivity).toLocaleDateString() : 'No activity'}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Last Payment</label>
            <div className="mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">
                {customer.lastPaymentDate ? new Date(customer.lastPaymentDate).toLocaleDateString() : 'No payments'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-500">Total Sales</label>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(customer.totalSales || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-500">Total Payments</label>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {formatCurrency(customer.totalPayments || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-500">Pending Balance</label>
          <div className={`mt-2 text-2xl font-bold ${(customer.pendingBalance || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatBalance(customer.pendingBalance || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-500">Current Balance</label>
          <div className={`mt-2 text-2xl font-bold ${customer.balance > 0 ? 'text-red-600' : customer.balance < 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {formatBalance(customer.balance || 0)}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          <button
            onClick={loadLedger}
            disabled={ledgerLoading}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${ledgerLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {ledgerLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Loading transactions...</p>
          </div>
        ) : ledger.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ledger.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{entry.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{entry.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.remarks || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${entry.balance > 0 ? 'text-red-600' : entry.balance < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {formatBalance(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerDetailPage
