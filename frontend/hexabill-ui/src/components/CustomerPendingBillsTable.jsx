import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../utils/currency'
import { filterPendingRows, overdueLabel, receivePaymentPath, totalOutstanding } from '../utils/pendingBills'

// Customers with open bills. Touch-first: 44px targets, numbers right-aligned, no wrapping of amounts.
// "Receive Payment" opens the customer ledger, which runs the existing idempotent payment flow (partial, full, Pay All).
const CustomerPendingBillsTable = ({ rows = [], loading = false, error = null, onRetry }) => {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const visible = useMemo(() => filterPendingRows(rows, query), [rows, query])

  if (loading) return <p className="p-4 text-sm text-neutral-500">Loading pending bills…</p>
  if (error) {
    return (
      <div className="p-4 text-sm text-error">
        <p>{error}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-2 min-h-[44px] px-4 rounded border border-neutral-300">Retry</button>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or TRN"
          aria-label="Search pending bills"
          className="min-h-[44px] w-full max-w-sm rounded border border-neutral-300 px-3"
        />
        <p className="text-sm font-semibold tabular-nums">
          Total due: {formatCurrency(totalOutstanding(visible))} <span className="text-neutral-500 font-normal">({visible.length} customers)</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">Customer</th>
              <th scope="col" className="px-3 py-2 text-left">Phone / TRN</th>
              <th scope="col" className="px-3 py-2 text-right">Bills</th>
              <th scope="col" className="px-3 py-2 text-right">Outstanding (AED)</th>
              <th scope="col" className="px-3 py-2 text-left">Overdue</th>
              <th scope="col" className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No customers with pending bills.</td></tr>
            )}
            {visible.map((row) => {
              const open = openId === row.customerId
              return (
                <React.Fragment key={row.customerId}>
                  <tr className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-medium">{row.customerName}</td>
                    <td className="px-3 py-2 text-neutral-600">{[row.phone, row.trn].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.pendingBillCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(row.totalOutstanding)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${row.overdueDays > 0 ? 'text-error' : 'text-neutral-600'}`}>{overdueLabel(row.overdueDays)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setOpenId(open ? null : row.customerId)} aria-expanded={open}
                          className="min-h-[44px] px-3 rounded border border-neutral-300">{open ? 'Hide bills' : 'View bills'}</button>
                        <Link to={receivePaymentPath(row.customerId)}
                          className="min-h-[44px] inline-flex items-center px-3 rounded bg-primary text-white">Receive payment</Link>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="px-3 py-2">
                        <table className="min-w-full text-xs">
                          <thead className="text-neutral-500">
                            <tr>
                              <th className="px-2 py-1 text-left">Invoice</th>
                              <th className="px-2 py-1 text-left">Source</th>
                              <th className="px-2 py-1 text-left">Invoice date</th>
                              <th className="px-2 py-1 text-left">Due</th>
                              <th className="px-2 py-1 text-right">Total</th>
                              <th className="px-2 py-1 text-right">Paid</th>
                              <th className="px-2 py-1 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(row.bills || []).map((bill) => (
                              <tr key={`${bill.source}-${bill.saleId ?? bill.legacyInvoiceId}`} className="border-t border-neutral-200">
                                <td className="px-2 py-1">{bill.invoiceNo || '—'}</td>
                                <td className="px-2 py-1">{bill.source === 'Historical' ? 'Historical (Starplus)' : 'Live'}</td>
                                <td className="px-2 py-1 whitespace-nowrap">{new Date(bill.invoiceDate).toLocaleDateString('en-GB')}</td>
                                <td className="px-2 py-1 whitespace-nowrap">{new Date(bill.dueDate).toLocaleDateString('en-GB')}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{Number(bill.grandTotal).toFixed(2)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{Number(bill.paidAmount).toFixed(2)}</td>
                                <td className="px-2 py-1 text-right tabular-nums font-semibold">{Number(bill.balanceDue).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CustomerPendingBillsTable
