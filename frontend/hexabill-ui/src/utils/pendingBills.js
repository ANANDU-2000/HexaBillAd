// Helpers for the customer pending-bills table. Pure functions so they can be tested without rendering.
import { buildCustomerLedgerHref } from './customerLedgerUrl.js'

/** Filters pending-summary rows by customer name, phone or TRN (case-insensitive). Empty query keeps every row. */
export function filterPendingRows(rows, query) {
  const list = Array.isArray(rows) ? rows : []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  return list.filter((row) =>
    [row.customerName, row.phone, row.trn].some((value) => String(value || '').toLowerCase().includes(q)))
}

/** The customer ledger opens on the Payments tab with Receive Payment open, so a partial or full payment can be
 *  recorded for this customer's open bills through the existing idempotent flow. Invalid ids fall back to the ledger. */
export function receivePaymentPath(customerId) {
  const id = Number(customerId)
  if (!Number.isInteger(id) || id <= 0) return '/ledger'
  return buildCustomerLedgerHref({ customerId: id, tab: 'payments', openPayment: true })
}

/** "3 days overdue", "Due today", or "Not yet due" from the server's overdueDays. */
export function overdueLabel(days) {
  const n = Number(days) || 0
  if (n <= 0) return 'Not yet due'
  return n === 1 ? '1 day overdue' : `${n} days overdue`
}

/** Sum of the outstanding amounts shown in the table (2-decimal rounding, matching the server). */
export function totalOutstanding(rows) {
  const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + (Number(row.totalOutstanding) || 0), 0)
  return Math.round(total * 100) / 100
}

/** Stable key for one bill in a customer's list (live id or legacy id), used for selection. */
export function billKey(bill) {
  if (!bill) return ''
  if (bill.source === 'Historical') return `legacy-${bill.legacyInvoiceId ?? bill.saleId}`
  return `live-${bill.saleId}`
}

/** True when this bill can be paid through the ledger's invoice-payment flow (a live sale id, not a historical id). */
export function isLiveBill(bill) {
  const saleId = Number(bill?.saleId)
  return (bill?.source === 'Live' || bill?.source === undefined) && Number.isInteger(saleId) && saleId > 0
}

/** Sum of the current balances of the selected bills (2-decimal rounding). selectedKeys: Set of billKey(). */
export function selectedBillsTotal(bills, selectedKeys) {
  const list = Array.isArray(bills) ? bills : []
  const keys = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || [])
  const total = list.reduce((sum, bill) => (keys.has(billKey(bill)) ? sum + (Number(bill.balanceDue) || 0) : sum), 0)
  return Math.round(total * 100) / 100
}

/** Deep link to pay the selected bills: one live bill -> that invoice; several -> the Payments tab with entry open. */
export function paySelectedPath(customerId, selectedBills) {
  const id = Number(customerId)
  if (!Number.isInteger(id) || id <= 0) return '/ledger'
  const live = (Array.isArray(selectedBills) ? selectedBills : []).filter(isLiveBill)
  if (live.length === 1) return buildCustomerLedgerHref({ customerId: id, tab: 'payments', recordPaymentSaleId: live[0].saleId })
  return buildCustomerLedgerHref({ customerId: id, tab: 'payments', openPayment: true })
}
