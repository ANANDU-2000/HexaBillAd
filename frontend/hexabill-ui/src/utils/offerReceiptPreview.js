import toast from 'react-hot-toast'
import { createElement } from 'react'
import {
  canReceivePaymentReceipt,
  normalizePaymentForReceipt,
  receiptIneligibilityReason
} from './receiptEligibility.js'

/** @returns {number|null} payment id when a post-payment receipt toast may be shown */
export function resolveReceiptOfferPaymentId (payment) {
  const normalized = normalizePaymentForReceipt(payment)
  if (!normalized || !canReceivePaymentReceipt(normalized)) return null
  const paymentId = Number(normalized.id)
  if (!Number.isFinite(paymentId) || paymentId <= 0) return null
  return paymentId
}

/** User-facing reason when a post-payment receipt offer is skipped (null if offer would show). */
export function receiptOfferBlockedMessage (payment) {
  if (resolveReceiptOfferPaymentId(payment) != null) return null
  if (!payment) return null
  return receiptIneligibilityReason(payment) || null
}

/**
 * Toast with action to open receipt preview (server re-validates eligibility).
 * @param {{ explainWhenBlocked?: boolean }} [options] when true, shows why no receipt toast was offered
 */
export function offerReceiptPreviewAfterPayment (payment, openPreview, options = {}) {
  const { explainWhenBlocked = true } = options
  const paymentId = resolveReceiptOfferPaymentId(payment)
  if (paymentId == null || typeof openPreview !== 'function') {
    if (explainWhenBlocked && payment && typeof openPreview === 'function') {
      const reason = receiptOfferBlockedMessage(payment)
      if (reason) {
        toast(reason, { duration: 7000, id: 'payment-receipt-blocked' })
      }
    }
    return
  }
  toast(
    (t) => createElement(
      'span',
      { className: 'flex flex-wrap items-center gap-2 text-sm' },
      createElement('span', null, 'Receipt ready.'),
      createElement(
        'button',
        {
          type: 'button',
          className: 'rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white',
          onClick: () => {
            toast.dismiss(t.id)
            openPreview(paymentId)
          }
        },
        'View receipt'
      )
    ),
    { duration: 10000, id: 'payment-receipt-offer' }
  )
}
