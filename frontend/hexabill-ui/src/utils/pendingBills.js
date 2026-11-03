// Helpers for the customer pending-bills table. Pure functions so they can be tested without rendering.

/** Filters pending-summary rows by customer name, phone or TRN (case-insensitive). Empty query keeps every row. */
export function filterPendingRows(rows, query) {
  const list = Array.isArray(rows) ? rows : []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  return list.filter((row) =>
    [row.customerName, row.phone, row.trn].some((value) => String(value || '').toLowerCase().includes(q)))
}

/** The customer ledger opens on this customer, where Receive Payment / Pay All run the existing, idempotent payment flow. */
export function receivePaymentPath(customerId) {
  const id = Number(customerId)
  return Number.isInteger(id) && id > 0 ? `/ledger?customerId=${id}` : '/ledger'
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
