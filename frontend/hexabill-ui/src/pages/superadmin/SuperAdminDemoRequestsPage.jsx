import { useState, useEffect } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  Mail, 
  Phone,
  Globe,
  Users,
  DollarSign,
  RefreshCw,
  Eye,
  Filter
} from 'lucide-react'
import { demoRequestAPI } from '../../services'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { Input, Select } from '../../components/Form'
import Modal from '../../components/Modal'
import { ModernTable } from '../../components/ui'
import toast from 'react-hot-toast'

const SuperAdminDemoRequestsPage = () => {
  const [loading, setLoading] = useState(true)
  const [demoRequests, setDemoRequests] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedDemo, setSelectedDemo] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [planId, setPlanId] = useState(1)
  const [trialDays, setTrialDays] = useState(14)

  useEffect(() => {
    fetchDemoRequests()
  }, [currentPage, statusFilter])

  const fetchDemoRequests = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        pageSize,
        status: statusFilter || undefined
      }
      const response = await demoRequestAPI.getAll(params)
      if (response.success) {
        setDemoRequests(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || 'Failed to load demo requests')
      }
    } catch (error) {
      console.error('Error loading demo requests:', error)
      toast.error('Failed to load demo requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedDemo) return
    try {
      const response = await demoRequestAPI.approve(selectedDemo.id, planId, trialDays)
      if (response.success) {
        toast.success('Demo request approved')
        setShowApproveModal(false)
        setSelectedDemo(null)
        fetchDemoRequests()
      } else {
        toast.error(response.message || 'Failed to approve')
      }
    } catch (error) {
      toast.error('Failed to approve demo request')
    }
  }

  const handleReject = async () => {
    if (!selectedDemo || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    try {
      const response = await demoRequestAPI.reject(selectedDemo.id, rejectReason)
      if (response.success) {
        toast.success('Demo request rejected')
        setShowRejectModal(false)
        setSelectedDemo(null)
        setRejectReason('')
        fetchDemoRequests()
      } else {
        toast.error(response.message || 'Failed to reject')
      }
    } catch (error) {
      toast.error('Failed to reject demo request')
    }
  }

  const handleConvert = async (id) => {
    try {
      const response = await demoRequestAPI.convertToTenant(id)
      if (response.success) {
        toast.success('Company created successfully')
        fetchDemoRequests()
      } else {
        toast.error(response.message || 'Failed to create company')
      }
    } catch (error) {
      toast.error('Failed to create company')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      Pending: <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>,
      Approved: <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approved</span>,
      Rejected: <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</span>,
      Converted: <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Converted</span>
    }
    return badges[status] || <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{status}</span>
  }

  const columns = [
    { key: 'companyName', label: 'Company', render: (row) => <div className="font-medium">{row.companyName}</div> },
    { key: 'contactName', label: 'Contact', render: (row) => row.contactName },
    { key: 'email', label: 'Email', render: (row) => <div className="flex items-center gap-1"><Mail className="w-4 h-4" />{row.email}</div> },
    { key: 'whatsapp', label: 'WhatsApp', render: (row) => row.whatsApp ? <div className="flex items-center gap-1"><Phone className="w-4 h-4" />{row.whatsApp}</div> : '-' },
    { key: 'country', label: 'Country', render: (row) => <div className="flex items-center gap-1"><Globe className="w-4 h-4" />{row.country}</div> },
    { key: 'industry', label: 'Industry', render: (row) => row.industry },
    { key: 'status', label: 'Status', render: (row) => getStatusBadge(row.status) },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'Pending' && (
            <>
              <button
                onClick={() => { setSelectedDemo(row); setShowApproveModal(true) }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Approve
              </button>
              <button
                onClick={() => { setSelectedDemo(row); setShowRejectModal(true) }}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </>
          )}
          {row.status === 'Approved' && !row.createdTenantId && (
            <button
              onClick={() => handleConvert(row.id)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Company
            </button>
          )}
          {row.createdTenantId && (
            <span className="text-sm text-green-600">Company #{row.createdTenantId}</span>
          )}
        </div>
      )
    }
  ]

  if (loading && demoRequests.length === 0) {
    return <LoadingCard />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demo Requests</h1>
          <p className="text-gray-600 mt-1">Manage demo requests from marketing site</p>
        </div>
        <button
          onClick={fetchDemoRequests}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
            className="w-48"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Converted">Converted</option>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <ModernTable
          columns={columns}
          data={demoRequests}
          loading={loading}
          pagination={{
            currentPage,
            totalPages: Math.ceil(totalCount / pageSize),
            onPageChange: setCurrentPage,
            totalCount
          }}
        />
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setSelectedDemo(null) }}
        title="Approve Demo Request"
      >
        {selectedDemo && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Company:</strong> {selectedDemo.companyName}</div>
                <div><strong>Contact:</strong> {selectedDemo.contactName}</div>
                <div><strong>Email:</strong> {selectedDemo.email}</div>
                <div><strong>WhatsApp:</strong> {selectedDemo.whatsApp || '-'}</div>
                <div><strong>Country:</strong> {selectedDemo.country}</div>
                <div><strong>Industry:</strong> {selectedDemo.industry}</div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Plan ID</label>
              <Input
                type="number"
                value={planId}
                onChange={(e) => setPlanId(parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Trial Days</label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value))}
                min="1"
                max="90"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Approve
              </button>
              <button
                onClick={() => { setShowApproveModal(false); setSelectedDemo(null) }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setSelectedDemo(null); setRejectReason('') }}
        title="Reject Demo Request"
      >
        {selectedDemo && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm">
                <strong>Company:</strong> {selectedDemo.companyName}<br />
                <strong>Contact:</strong> {selectedDemo.contactName}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setSelectedDemo(null); setRejectReason('') }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SuperAdminDemoRequestsPage

