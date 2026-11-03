import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Layers, RefreshCw } from 'lucide-react'
import { customersAPI } from '../../services/index'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import CustomerPendingBillsTable from '../../components/CustomerPendingBillsTable'

// Customers with open bills (live + historical Starplus). "Receive payment" within the table deep-links to the
// customer's ledger Payments tab, where the existing idempotent flow records partial or full payments, refreshes
// the balance, and guards against duplicate postings. This page reloads the summary on mount, on focus (returning
// after recording a payment) and on payment/save events so amounts and "now paid" rows stay in sync.
const PendingBillsPage = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    try {
      const res = await customersAPI.getPendingSummary()
      if (requestId !== requestIdRef.current) return
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data)
      } else {
        setRows([])
        setError(res?.message || 'Pending bills could not be loaded.')
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setRows([])
      setError(err?.response?.data?.message || err?.message || 'Pending bills could not be loaded.')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refetch when returning to this tab and after any payment/save recorded elsewhere (balances and "paid" rows change).
  useEffect(() => {
    const refresh = () => load()
    window.addEventListener('focus', refresh)
    window.addEventListener('dataUpdated', refresh)
    window.addEventListener('paymentCreated', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('dataUpdated', refresh)
      window.removeEventListener('paymentCreated', refresh)
    }
  }, [load])

  return (
    <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${mobilePageShellClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary-600" aria-hidden />
          <h1 className="text-xl font-bold text-neutral-900">Pending Bills</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/payments?bulk=1"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            title="Record payments for several customers in one batch"
          >
            <Layers className="h-4 w-4" aria-hidden />
            Bulk payment
          </Link>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-neutral-600">
        Customers with open bills. Choose a customer to record a partial or full payment for one or more bills.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <CustomerPendingBillsTable rows={rows} loading={loading} error={error} onRetry={() => load()} />
      </div>
    </div>
  )
}

export default PendingBillsPage