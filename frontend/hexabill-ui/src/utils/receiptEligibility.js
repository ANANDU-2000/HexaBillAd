// UI guidance only; receipt eligibility is checked again by the tenant-scoped server.

/** Normalize API payment rows (camelCase or PascalCase). */
export function normalizePaymentForReceipt (payment) {
  if (!payment || typeof payment !== 'object') return null
  const id = Number(payment.id ?? payment.Id)
  const rawStatus = payment.status ?? payment.Status
  const rawMode = payment.mode ?? payment.Mode ?? payment.method ?? payment.Method
  return {
    id: Number.isFinite(id) ? id : (payment.id ?? payment.Id),
    status: rawStatus == null ? '' : String(rawStatus),
    mode: rawMode == null ? '' : String(rawMode),
    amount: payment.amount ?? payment.Amount,
    saleReturnId: payment.saleReturnId ?? payment.SaleReturnId ?? null,
    isRefund: Boolean(payment.isRefund ?? payment.IsRefund),
    isSettlementAdjustment: Boolean(payment.isSettlementAdjustment ?? payment.IsSettlementAdjustment)
  }
}

/** Map a customer-ledger Payment row to a receipt-eligibility shape (camelCase or PascalCase). */
export function paymentFromCustomerLedgerEntry (entry) {
  if (!entry || String(entry.type || '').toLowerCase() !== 'payment') return null
  const id = entry.paymentId ?? entry.PaymentId
  if (id == null || id === '') return null
  const amount = entry.credit ?? entry.amount ?? entry.realGotPayment ?? entry.Credit
  return {
    id,
    amount,
    status: entry.paymentLineStatus ?? entry.paymentStatus ?? entry.status ?? '',
    mode: entry.paymentMode ?? entry.PaymentMode,
    saleReturnId: entry.saleReturnId ?? entry.SaleReturnId,
    isRefund: entry.isRefund ?? entry.IsRefund,
    isSettlementAdjustment: entry.isSettlementAdjustment ?? entry.IsSettlementAdjustment
  }
}

export function canReceivePaymentReceipt (payment) {
  const p = normalizePaymentForReceipt(payment)
  if (!p || p.isSettlementAdjustment) return false
  const idNum = Number(p.id)
  return Number.isSafeInteger(idNum) && idNum > 0 &&
    p.status.toUpperCase() === 'CLEARED' &&
    Number.isFinite(Number(p.amount)) && Number(p.amount) > 0 &&
    p.saleReturnId == null && !p.isRefund &&
    ['CASH', 'CHEQUE', 'ONLINE', 'DEBIT'].includes(p.mode.toUpperCase())
}

/** User-facing reason when a receipt action is blocked (UI only). */
export function receiptIneligibilityReason (payment) {
  const p = normalizePaymentForReceipt(payment)
  if (!p) return 'Payment not found.'
  if (p.isSettlementAdjustment) {
    return 'Settlement adjustments do not generate payment receipts.'
  }
  if (p.isRefund || p.saleReturnId != null) {
    return 'Refunds and return credits cannot be printed as payment receipts.'
  }
  const idNum = Number(p.id)
  if (!Number.isFinite(idNum) || idNum <= 0) return 'Save the payment before generating a receipt.'
  if (p.status.toUpperCase() !== 'CLEARED') {
    return `Only cleared payments can produce receipts (current status: ${p.status || 'unknown'}).`
  }
  if (!Number.isFinite(Number(p.amount)) || Number(p.amount) <= 0) {
    return 'Receipts require a positive payment amount.'
  }
  if (!['CASH', 'CHEQUE', 'ONLINE', 'DEBIT'].includes(p.mode.toUpperCase())) {
    return 'This payment mode cannot produce a customer receipt.'
  }
  return 'This payment cannot produce a receipt.'
}

export function currentReceiptSelection(payments, selectedIds) {
  const eligible = new Set(payments.filter(canReceivePaymentReceipt).map(payment => payment.id))
  return [...new Set(selectedIds)].filter(id => eligible.has(id))
}

export function paymentStatusLabel(payment) {
  const p = normalizePaymentForReceipt(payment)
  switch (p?.status.toUpperCase()) {
    case 'CLEARED': return p.mode.toUpperCase() === 'CHEQUE' ? 'Cleared' : 'Completed'
    case 'PENDING': return 'Pending'
    case 'RETURNED': return 'Returned'
    case 'VOID': return 'Voided'
    default: return 'Unknown'
  }
}

export function receiptSelectionSummary(payments, selectedIds, visiblePayments = payments) {
  const ids = currentReceiptSelection(payments, selectedIds)
  const selected = payments.filter(payment => ids.includes(payment.id))
  const visibleIds = visiblePayments.filter(canReceivePaymentReceipt).map(payment => payment.id)
  return {
    ids, visibleIds,
    total: Math.round(selected.reduce((sum,payment) => sum + Number(payment.amount),0) * 100) / 100,
    customerCount: new Set(selected.map(payment => String(payment.customerId ?? payment.CustomerId ?? 'cash'))).size,
    allVisibleSelected: visibleIds.length > 0 && visibleIds.every(id => ids.includes(id)),
  }
}

export function toggleVisibleReceiptSelection(selectedIds, visibleIds) {
  if (visibleIds.every(id => selectedIds.includes(id))) return selectedIds.filter(id => !visibleIds.includes(id))
  return [...new Set([...selectedIds,...visibleIds])]
}
