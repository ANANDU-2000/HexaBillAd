import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, FileText, CreditCard, Calendar } from 'lucide-react'
import { suppliersAPI, purchasesAPI } from '../../services'
import { formatCurrency } from '../../utils/currency'
import SupplierLedgerModal from '../../components/SupplierLedgerModal'
import toast from 'react-hot-toast'

const tabs = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'ledger', label: 'Ledger', icon: DollarSign },
  { id: 'purchases', label: 'Purchase History', icon: FileText },
  { id: 'payments', label: 'Payment History', icon: CreditCard }
]

const SupplierDetailPage = () => {
  const { name } = useParams()
  const supplierName = name ? decodeURIComponent(name) : ''
  const [activeTab, setActiveTab] = useState('summary')
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (supplierName) {
      loadData()
    }
  }, [supplierName, activeTab, fromDate, toDate])

  const loadData = async () => {
    if (!supplierName) return
    try {
      setLoading(true)
      if (activeTab === 'summary' || activeTab === 'ledger') {
        const [balanceRes, transactionsRes] = await Promise.all([
          suppliersAPI.getSupplierBalance(supplierName),
          suppliersAPI.getSupplierTransactions(supplierName, fromDate || undefined, toDate || undefined)
        ])
        if (balanceRes?.success && balanceRes?.data) setBalance(balanceRes.data)
        if (transactionsRes?.success && transactionsRes?.data) setTransactions(transactionsRes.data)
      } else if (activeTab === 'purchases') {
        const res = await purchasesAPI.getPurchases({ supplierName, pageSize: 100 })
        if (res?.success && res?.data?.items) setPurchases(res.data.items)
        else setPurchases([])
      } else if (activeTab === 'payments') {
        const res = await suppliersAPI.getSupplierTransactions(supplierName, fromDate || undefined, toDate || undefined)
        if (res?.success && res?.data) {
          const payments = (res.data || []).filter(t => (t.type || '').toLowerCase() === 'payment')
          setTransactions(payments)
        } else setTransactions([])
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-')
  const payments = (transactions || []).filter(t => (t.type || '').toLowerCase() === 'payment')

  if (!supplierName) {
    return (
      <div className="p-4 sm:p-6 max-w-full">
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Suppliers
        </Link>
        <p className="text-primary-600">Invalid or missing supplier. Please choose a supplier from the list.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-full">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/suppliers" className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to Suppliers
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-900">{supplierName}</h1>
        <p className="text-primary-600 mt-1">Supplier detail and transaction history</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-primary-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t font-medium text-sm ${
              activeTab === t.id ? 'bg-primary-100 text-primary-800 border-b-2 border-primary-600 -mb-[2px]' : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setLedgerOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 rounded font-medium text-sm text-green-800"
        >
          <DollarSign className="h-4 w-4" /> Open Ledger Modal
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-primary-500">Loading...</div>
      ) : (
        <>
          {activeTab === 'summary' && balance && (
            <div className="bg-white rounded-lg border-2 border-lime-300 p-6">
              <h2 className="text-lg font-bold text-primary-800 mb-4">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">Total Purchases</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(balance.totalPurchases || 0)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Total Payments</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(balance.totalPayments || 0)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-sm text-amber-700 font-medium">Outstanding</p>
                  <p className="text-xl font-bold text-amber-900">{formatCurrency(balance.netPayable || 0)}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-sm text-neutral-700 font-medium">Last Payment</p>
                  <p className="text-lg font-bold text-neutral-900">{formatDate(balance.lastPaymentDate)}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="bg-white rounded-lg border-2 border-lime-300 overflow-hidden">
              <div className="p-4 border-b border-lime-300 flex flex-wrap gap-2 items-center">
                <Calendar className="h-4 w-4 text-primary-500" />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                <span className="text-primary-500">to</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-100">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Reference</th>
                      <th className="text-right p-2">Debit</th>
                      <th className="text-right p-2">Credit</th>
                      <th className="text-right p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-primary-500">No transactions</td></tr>
                    ) : (
                      transactions.map((t, i) => (
                        <tr key={i} className="border-t border-primary-100 hover:bg-primary-50">
                          <td className="p-2">{formatDate(t.date)}</td>
                          <td className="p-2 font-medium">{t.type}</td>
                          <td className="p-2">{t.reference || '-'}</td>
                          <td className="p-2 text-right">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                          <td className="p-2 text-right">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(t.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="bg-white rounded-lg border-2 border-lime-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-100">
                    <tr>
                      <th className="text-left p-2">Invoice No</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Paid</th>
                      <th className="text-right p-2">Balance</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-primary-500">No purchases</td></tr>
                    ) : (
                      purchases.map(p => (
                        <tr key={p.id} className="border-t border-primary-100 hover:bg-primary-50">
                          <td className="p-2 font-medium">{p.invoiceNo}</td>
                          <td className="p-2">{formatDate(p.purchaseDate)}</td>
                          <td className="p-2 text-right">{formatCurrency(p.totalAmount || 0)}</td>
                          <td className="p-2 text-right text-green-600">{formatCurrency(p.paidAmount || 0)}</td>
                          <td className="p-2 text-right text-amber-600">{formatCurrency(p.balanceAmount || 0)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              (p.paymentStatus || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                              (p.paymentStatus || '').toLowerCase() === 'partial' ? 'bg-amber-100 text-amber-800' :
                              'bg-neutral-100 text-neutral-700'
                            }`}>
                              {p.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-lg border-2 border-lime-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-100">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Reference</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-primary-500">No payments</td></tr>
                    ) : (
                      payments.map((t, i) => (
                        <tr key={i} className="border-t border-primary-100 hover:bg-primary-50">
                          <td className="p-2">{formatDate(t.date)}</td>
                          <td className="p-2">{t.reference || '-'}</td>
                          <td className="p-2 text-right font-medium text-green-700">{formatCurrency(t.credit || 0)}</td>
                          <td className="p-2 text-right">{formatCurrency(t.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <SupplierLedgerModal
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        supplierName={supplierName}
        onPaymentRecorded={() => { loadData(); setLedgerOpen(false) }}
      />
    </div>
  )
}

export default SupplierDetailPage
