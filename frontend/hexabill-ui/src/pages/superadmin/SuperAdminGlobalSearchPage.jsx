import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, FileText, Users, Building2, ExternalLink } from 'lucide-react'
import { superAdminAPI } from '../../services'
import { useDebounce } from '../../hooks/useDebounce'
import { formatCurrency } from '../../utils/currency'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const SuperAdminGlobalSearchPage = () => {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState({ invoices: [], customers: [] })
  const debouncedQuery = useDebounce(query.trim(), 400)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResult({ invoices: [], customers: [] })
      return
    }
    let cancelled = false
    setLoading(true)
    superAdminAPI
      .globalSearch(debouncedQuery, 25)
      .then((res) => {
        if (cancelled) return
        if (res?.success && res?.data) {
          setResult({
            invoices: res.data.invoices || [],
            customers: res.data.customers || []
          })
        } else {
          setResult({ invoices: [], customers: [] })
        }
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err?.response?.data?.message || 'Search failed')
        setResult({ invoices: [], customers: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const hasResults = result.invoices.length > 0 || result.customers.length > 0
  const showHint = debouncedQuery.length > 0 && debouncedQuery.length < 2

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 tracking-tight mb-2">Global Search</h1>
        <p className="text-neutral-500 mb-6">
          Find invoices or customers across all companies. Read-only; open the company to view details.
        </p>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice #, customer name, phone, or email (min 2 characters)..."
            className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoFocus
          />
        </div>

        {showHint && (
          <p className="text-sm text-amber-600 mb-4">Enter at least 2 characters to search.</p>
        )}

        {loading && <LoadingCard />}

        {!loading && debouncedQuery.length >= 2 && (
          <>
            {!hasResults && (
              <p className="text-neutral-500">No invoices or customers found for &quot;{debouncedQuery}&quot;.</p>
            )}

            {hasResults && (
              <div className="space-y-8">
                {result.invoices.length > 0 && (
                  <section>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-800 mb-3">
                      <FileText className="h-5 w-5 text-indigo-600" />
                      Invoices ({result.invoices.length})
                    </h2>
                    <ul className="bg-white rounded-xl border border-neutral-200 shadow-sm divide-y divide-neutral-100 overflow-hidden">
                      {result.invoices.map((inv) => (
                        <li key={`inv-${inv.tenantId}-${inv.saleId}`} className="p-4 hover:bg-neutral-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-medium text-neutral-900">{inv.invoiceNo}</span>
                              <span className="text-neutral-500">·</span>
                              <span className="text-neutral-600">{inv.customerName || '—'}</span>
                              <span className="text-neutral-400 text-sm">
                                {new Date(inv.invoiceDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-700">{formatCurrency(inv.grandTotal)}</span>
                              <Link
                                to={`/superadmin/tenants/${inv.tenantId}`}
                                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                <Building2 className="h-4 w-4" />
                                {inv.tenantName}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {result.customers.length > 0 && (
                  <section>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-800 mb-3">
                      <Users className="h-5 w-5 text-indigo-600" />
                      Customers ({result.customers.length})
                    </h2>
                    <ul className="bg-white rounded-xl border border-neutral-200 shadow-sm divide-y divide-neutral-100 overflow-hidden">
                      {result.customers.map((c) => (
                        <li key={`cust-${c.tenantId}-${c.customerId}`} className="p-4 hover:bg-neutral-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-medium text-neutral-900">{c.name}</span>
                              {(c.phone || c.email) && (
                                <span className="text-neutral-500 text-sm ml-2">
                                  {[c.phone, c.email].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                            <Link
                              to={`/superadmin/tenants/${c.tenantId}`}
                              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Building2 className="h-4 w-4" />
                              {c.tenantName}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SuperAdminGlobalSearchPage
