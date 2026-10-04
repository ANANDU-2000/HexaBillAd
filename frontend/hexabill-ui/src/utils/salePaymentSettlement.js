/**
 * Sale invoice settlement rules — keep in sync with backend SalePaymentHelpers.
 * Use these helpers anywhere the UI shows Paid / Partial / Pending for sales (POS, Billing History, dashboards).
 */

export const SETTLEMENT_TOLERANCE_AED = 0.05
/** @see SalePaymentHelpers.MaxExplicitSettlementAdjustmentAed */
export const MAX_SETTLEMENT_ADJUSTMENT_AED = 50
export const TENANT_FEATURE_SETTLEMENT_ADJUSTMENTS = 'settlement_adjustments'

export function computeOutstanding(grandTotal, paidAmount) {
  const gt = Number(grandTotal) || 0
  const paid = Number(paidAmount) || 0
  return Math.max(0, gt - paid)
}

/**
 * Shortfall after cash that may be closed with an explicit settlement adjustment (not tolerance auto-fill).
 */
export function computeInvoiceSettlementShortfall(outstandingAmount, cashAmount) {
  const outstanding = Math.round((Number(outstandingAmount) || 0) * 100) / 100
  const cash = Math.round((Number(cashAmount) || 0) * 100) / 100
  if (outstanding <= 0 || cash <= 0 || cash >= outstanding) return 0
  const shortfall = Math.round((outstanding - cash) * 100) / 100
  if (shortfall <= SETTLEMENT_TOLERANCE_AED) return 0
  if (shortfall > MAX_SETTLEMENT_ADJUSTMENT_AED) return 0
  return shortfall
}

/**
 * True when the invoice is fully settled (API says Paid, zero/negative total, or outstanding within tolerance).
 */
export function isInvoiceFullySettled({ grandTotal, paidAmount, paymentStatus } = {}) {
  const st = String(paymentStatus || '').toLowerCase()
  if (st === 'paid') return true
  const gt = Number(grandTotal) || 0
  if (gt <= 0) return true
  return computeOutstanding(gt, paidAmount) <= SETTLEMENT_TOLERANCE_AED
}

/**
 * Badge label + Tailwind classes for sales list rows (aligns amounts with API status).
 */
export function getInvoicePaymentBadge(sale) {
  const gt = Number(sale?.grandTotal) || 0
  const paid = Number(sale?.paidAmount) || 0
  const status = sale?.paymentStatus
  if (isInvoiceFullySettled({ grandTotal: gt, paidAmount: paid, paymentStatus: status })) {
    return { label: 'Paid', colorClass: 'bg-green-100 text-green-800' }
  }
  const s = String(status || '').toLowerCase()
  if (s.includes('partial')) {
    return { label: 'Partial', colorClass: 'bg-yellow-100 text-yellow-800' }
  }
  return { label: 'Pending', colorClass: 'bg-red-100 text-red-800' }
}
