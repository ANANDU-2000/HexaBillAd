import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Eye, RefreshCw, Phone } from 'lucide-react'
import { suppliersAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import SupplierLedgerModal from '../../components/SupplierLedgerModal'
import toast from 'react-hot-toast'

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([])
  const [filteredSuppliers, setFilteredSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [ledgerSupplier, setLedgerSupplier] = useState(null)
  const [overdueOnly, setOverdueOnly] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    let list = suppliers
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(s => (s.supplierName || '').toLowerCase().includes(term) || (s.phone || '').includes(term))
    }
    if (overdueOnly) {
      list = list.filter(s => (s.overdue || 0) > 0)
    }
    setFilteredSuppliers(list)
  }, [suppliers, searchTerm, overdueOnly])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const response = await suppliersAPI.getAllSuppliersSummary()
      if (response?.success && response?.data) {
        setSuppliers(response.data)
      } else {
        setSuppliers([])
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
      toast.error('Failed to load suppliers')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-'

  return (
    <div className="p-4 sm:p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-900">Suppliers</h1>
        <p className="text-primary-600 mt-1">Manage suppliers and view outstanding balances.</p>
      </div>

      <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border-2 border-lime-300 rounded"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} className="rounded" />
            <span className="text-sm text-primary-700">Overdue only</span>
          </label>
          <button onClick={loadSuppliers} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-primary-100 hover:bg-primary-200 rounded font-medium">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border-2 border-lime-300 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-primary-500">Loading suppliers...</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-100">
                  <tr>
                    <th className="text-left p-3 font-medium text-primary-800">Supplier</th>
                    <th className="text-left p-3 font-medium text-primary-800">Phone</th>
                    <th className="text-right p-3 font-medium text-primary-800">Total Purchases</th>
                    <th className="text-right p-3 font-medium text-primary-800">Total Paid</th>
                    <th className="text-right p-3 font-medium text-primary-800">Outstanding</th>
                    <th className="text-right p-3 font-medium text-primary-800">Overdue</th>
                    <th className="text-center p-3 font-medium text-primary-800">Last Purchase</th>
                    <th className="text-center p-3 font-medium text-primary-800">Invoices</th>
                    <th className="text-center p-3 font-medium text-primary-800">Last Payment</th>
                    <th className="p-3 font-medium text-primary-800">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-primary-500">No suppliers found</td></tr>
                  ) : (
                    filteredSuppliers.map((s, i) => (
                      <tr key={i} className="border-t border-primary-100 hover:bg-primary-50">
                        <td className="p-3 font-medium text-primary-900">{s.supplierName}</td>
                        <td className="p-3 text-primary-600">{s.phone || '-'}</td>
                        <td className="p-3 text-right">{formatCurrency(s.totalPurchases || 0)}</td>
                        <td className="p-3 text-right text-green-700">{formatCurrency(s.totalPaid || 0)}</td>
                        <td className="p-3 text-right font-medium text-amber-700">{formatCurrency(s.netPayable || 0)}</td>
                        <td className="p-3 text-right">{formatCurrency(s.overdue || 0)}</td>
                        <td className="p-3 text-center text-sm">{formatDate(s.lastPurchaseDate)}</td>
                        <td className="p-3 text-center">{s.invoiceCount ?? '-'}</td>
                        <td className="p-3 text-center text-sm">{formatDate(s.lastPaymentDate)}</td>
                        <td className="p-3">
                          <button onClick={() => setLedgerSupplier(s.supplierName)} className="flex items-center gap-1 px-2 py-1 bg-primary-100 hover:bg-primary-200 rounded text-sm">
                            <Eye className="h-4 w-4" /> View Ledger
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3 p-4">
              {filteredSuppliers.length === 0 ? (
                <p className="text-center text-primary-500 py-8">No suppliers found</p>
              ) : (
                filteredSuppliers.map((s, i) => (
                  <div key={i} className="bg-primary-50 rounded-lg border border-primary-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Link to={`/suppliers/${encodeURIComponent(s.supplierName)}`} className="font-medium text-primary-900 hover:text-primary-700 underline">
                          {s.supplierName}
                        </Link>
                        {s.phone && <p className="text-sm text-primary-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}
                      </div>
                      <p className="font-bold text-amber-700">{formatCurrency(s.netPayable || 0)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-primary-600 mb-3">
                      <p>Purchases: {formatCurrency(s.totalPurchases || 0)}</p>
                      <p>Paid: {formatCurrency(s.totalPaid || 0)}</p>
                      <p>Last Purchase: {formatDate(s.lastPurchaseDate)}</p>
                      <p>Invoices: {s.invoiceCount ?? '-'}</p>
                    </div>
                    <button onClick={() => setLedgerSupplier(s.supplierName)} className="w-full flex items-center justify-center gap-1 py-2 bg-primary-200 hover:bg-primary-300 rounded text-sm font-medium">
                      <Eye className="h-4 w-4" /> View Ledger
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <SupplierLedgerModal
        isOpen={!!ledgerSupplier}
        onClose={() => setLedgerSupplier(null)}
        supplierName={ledgerSupplier}
        onPaymentRecorded={loadSuppliers}
      />
    </div>
  )
}

export default SuppliersPage
