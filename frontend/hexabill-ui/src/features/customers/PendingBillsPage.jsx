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
    <div className={`min-h-0 flex-1 overflow-y-auto ${mobilePageShellClass}`}>
      {/* One row: title, search, total due and the two page buttons. Press "Pay" on a row to record a payment. */}
      <CustomerPendingBillsTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={() => load()}
        leading={(
          <h1 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            <Wallet className="h-5 w-5 text-primary-600" aria-hidden />
            Pending Bills
          </h1>
        )}
        trailing={(
          <>
            <Link
              to="/payments?bulk=1"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
              title="Record payments for several customers in one batch"
            >
              <Layers className="h-4 w-4" aria-hidden />
              Bulk payment
            </Link>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </>
        )}
      />
    </div>
  )
}

export default PendingBillsPage