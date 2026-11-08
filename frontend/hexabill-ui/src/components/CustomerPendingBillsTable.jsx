import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { billKey, filterPendingRows, isLiveBill, overdueLabel, paySelectedPath, receivePaymentPath, selectedBillsTotal, totalOutstanding } from '../utils/pendingBills'

// Customers with open bills. Dense rows so a full screen of customers is visible, and every action stays on screen
// (no sideways scroll). "Pay" opens the customer ledger on the Payments tab with Receive Payment open, which runs the
// existing idempotent payment flow (partial, full). Ticking live bills and pressing "Pay selected" pays just those.
// `leading` / `trailing` let the page put its title and buttons on the same row as the search and the total.
const CustomerPendingBillsTable = ({ rows = [], loading = false, error = null, onRetry, leading = null, trailing = null }) => {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  // customerId -> Set of billKey() of selected LIVE bills (historical/Starplus rows are paid from the ledger via "Pay").
  const [selected, setSelected] = useState({})
  const toggleBill = (customerId, key) => {
    setSelected((prev) => {
      const set = new Set(prev[customerId] || [])
      if (set.has(key)) set.delete(key); else set.add(key)
      return { ...prev, [customerId]: set }
    })
  }
  const setCustomerSelection = (customerId, keys) => setSelected((prev) => ({ ...prev, [customerId]: new Set(keys) }))
  const visible = useMemo(() => filterPendingRows(rows, query), [rows, query])

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {leading}
      <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or TRN"
          aria-label="Search pending bills"
          className="min-h-[40px] w-full rounded-md border border-neutral-300 pl-9 pr-3 text-sm"
        />
      </div>
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
        Total due: {formatCurrency(totalOutstanding(visible))} <span className="font-normal text-neutral-500">({visible.length} customers)</span>
      </p>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )

  if (loading) return <div className="space-y-2">{toolbar}<p className="p-3 text-sm text-neutral-500">Loading pending bills…</p></div>
  if (error) {
    return (
      <div className="space-y-2">
        {toolbar}
        <div className="p-3 text-sm text-error">
          <p>{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mt-2 min-h-[44px] rounded border border-neutral-300 px-4">Retry</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {toolbar}

      <div className="rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Customer</th>
              <th scope="col" className="hidden px-3 py-1.5 text-left font-semibold xl:table-cell">Phone / TRN</th>
              <th scope="col" className="hidden px-2 py-1.5 text-right font-semibold sm:table-cell">Bills</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold sm:px-3">Outstanding</th>
              <th scope="col" className="hidden px-3 py-1.5 text-left font-semibold lg:table-cell">Overdue</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No customers with pending bills.</td></tr>
            )}
            {visible.map((row) => {
              const open = openId === row.customerId
              const contact = [row.phone, row.trn].filter(Boolean).join(' / ')
              const overdue = row.overdueDays > 0
              const liveBills = (row.bills || []).filter(isLiveBill)
              const sel = selected[row.customerId] || new Set()
              const selBills = (row.bills || []).filter((bill) => sel.has(billKey(bill)))
              const allLiveSelected = liveBills.length > 0 && liveBills.every((bill) => sel.has(billKey(bill)))
              return (
                <React.Fragment key={row.customerId}>
                  <tr className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="w-full max-w-0 px-2 py-1.5 sm:w-auto sm:max-w-[16rem] sm:px-3">
                      <button type="button" onClick={() => setOpenId(open ? null : row.customerId)} aria-expanded={open}
                        className="flex w-full min-w-0 items-center gap-1.5 text-left font-medium text-neutral-900">
                        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />}
                        <span className="min-w-0">
                          <span className="block truncate">{row.customerName}</span>
                          {/* Contact and overdue move under the name where their columns are hidden (tablet portrait, phone). */}
                          <span className="block truncate text-xs font-normal text-neutral-500 xl:hidden">
                            <span className="lg:hidden"><span className={overdue ? 'text-error' : ''}>{overdueLabel(row.overdueDays)}</span>{contact ? ' · ' : ''}</span>{contact}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-3 py-1.5 text-neutral-600 xl:table-cell">{contact || '—'}</td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums sm:table-cell">{row.pendingBillCount}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums sm:px-3">{formatCurrency(row.totalOutstanding)}</td>
                    <td className={`hidden whitespace-nowrap px-3 py-1.5 lg:table-cell ${overdue ? 'text-error' : 'text-neutral-600'}`}>{overdueLabel(row.overdueDays)}</td>
                    <td className="px-2 py-1.5 sm:px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setOpenId(open ? null : row.customerId)} aria-expanded={open}
                          className="hidden min-h-[40px] whitespace-nowrap rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-100 sm:inline-flex sm:items-center">{open ? 'Hide bills' : 'Bills'}</button>
                        <Link to={receivePaymentPath(row.customerId)} aria-label={`Receive payment from ${row.customerName}`}
                          className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">Pay</Link>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="px-3 py-2">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <label className={`inline-flex items-center gap-2 text-xs ${liveBills.length ? 'text-neutral-700' : 'text-neutral-400'}`}>
                            <input
                              type="checkbox"
                              disabled={!liveBills.length}
                              checked={allLiveSelected}
                              onChange={() => setCustomerSelection(row.customerId, allLiveSelected ? [] : liveBills.map(billKey))}
                              className="h-4 w-4 accent-primary-600"
                            />
                            Select all live bills
                          </label>
                          {selBills.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold tabular-nums">{selBills.length} selected · Total {formatCurrency(selectedBillsTotal(row.bills, sel))}</p>
                              <button type="button" onClick={() => setCustomerSelection(row.customerId, [])} className="min-h-[40px] rounded-md border border-neutral-300 px-3 text-sm text-neutral-700">Clear</button>
                              <Link to={paySelectedPath(row.customerId, selBills)} className="inline-flex min-h-[40px] items-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">Pay selected</Link>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-500">Tick live bills to pay just those. Historical bills are paid with “Pay”.</p>
                          )}
                        </div>
                        <table className="w-full text-xs">
                          <thead className="text-neutral-500">
                            <tr>
                              <th className="w-8 px-2 py-1 text-left"><span className="sr-only">Select</span></th>
                              <th className="px-2 py-1 text-left">Invoice</th>
                              <th className="hidden px-2 py-1 text-left md:table-cell">Source</th>
                              <th className="hidden px-2 py-1 text-left md:table-cell">Invoice date</th>
                              <th className="px-2 py-1 text-left">Due</th>
                              <th className="hidden px-2 py-1 text-right sm:table-cell">Total</th>
                              <th className="hidden px-2 py-1 text-right sm:table-cell">Paid</th>
                              <th className="px-2 py-1 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(row.bills || []).map((bill) => (
                              <tr key={`${bill.source}-${bill.saleId ?? bill.legacyInvoiceId}`} className="border-t border-neutral-200">
                                <td className="px-2 py-1">
                                  {isLiveBill(bill) ? (
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${bill.invoiceNo || 'bill'}`}
                                      checked={sel.has(billKey(bill))}
                                      onChange={() => toggleBill(row.customerId, billKey(bill))}
                                      className="h-4 w-4 accent-primary-600"
                                    />
                                  ) : null}
                                </td>
                                <td className="px-2 py-1">{bill.invoiceNo || '—'}</td>
                                <td className="hidden px-2 py-1 md:table-cell">{bill.source === 'Historical' ? 'Historical (Starplus)' : 'Live'}</td>
                                <td className="hidden whitespace-nowrap px-2 py-1 md:table-cell">{new Date(bill.invoiceDate).toLocaleDateString('en-GB')}</td>
                                <td className="whitespace-nowrap px-2 py-1">{new Date(bill.dueDate).toLocaleDateString('en-GB')}</td>
                                <td className="hidden px-2 py-1 text-right tabular-nums sm:table-cell">{Number(bill.grandTotal).toFixed(2)}</td>
                                <td className="hidden px-2 py-1 text-right tabular-nums sm:table-cell">{Number(bill.paidAmount).toFixed(2)}</td>
                                <td className="px-2 py-1 text-right font-semibold tabular-nums">{Number(bill.balanceDue).toFixed(2)}</td>
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
