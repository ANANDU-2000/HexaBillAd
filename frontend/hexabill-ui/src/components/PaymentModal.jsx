import { useState, useEffect, useRef } from 'react'
import { X, Wallet, DollarSign, Calendar, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsAPI, salesAPI, subscriptionAPI } from '../services'
import ConfirmDangerModal from './ConfirmDangerModal'
import { localDateString } from '../utils/dateFormat'
import {
  computeInvoiceSettlementShortfall,
  TENANT_FEATURE_SETTLEMENT_ADJUSTMENTS
} from '../utils/salePaymentSettlement'
import {
  offerReceiptPreviewAfterPayment,
  receiptOfferBlockedMessage
} from '../utils/offerReceiptPreview'
import { formatCurrency } from '../utils/currency'
import { useBranding } from '../tenant/TenantBrandingContext'

const PaymentModal = ({ isOpen, onClose, invoiceId, customerId, onPaymentSuccess, onReceiptPreview }) => {
  const { currency: tenantCurrency = 'AED' } = useBranding()
  const money = (value) => formatCurrency(value, tenantCurrency)
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false) // Confirmation step
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const submitButtonRef = useRef(null) // Prevent double-click
  const submissionInProgressRef = useRef(false) // Track submission state synchronously
  const [formData, setFormData] = useState({
    amount: 0,
    mode: 'CASH',
    reference: '',
    paymentDate: localDateString(new Date())
  })
  const [settlementAdjustmentsEnabled, setSettlementAdjustmentsEnabled] = useState(false)
  const [applySettlementAdjustment, setApplySettlementAdjustment] = useState(false)
  const [settlementAdjustmentReason, setSettlementAdjustmentReason] = useState('')

  const outstandingAmount = Number(invoice?.outstandingAmount) || 0
  const settlementShortfall = invoiceId && formData.mode === 'CASH'
    ? computeInvoiceSettlementShortfall(outstandingAmount, formData.amount)
    : 0

  useEffect(() => {
    if (!isOpen) {
      setApplySettlementAdjustment(false)
      setSettlementAdjustmentReason('')
      setShowConfirmation(false)
      return
    }
    let cancelled = false
    subscriptionAPI.checkFeature(TENANT_FEATURE_SETTLEMENT_ADJUSTMENTS)
      .then((res) => {
        if (!cancelled) setSettlementAdjustmentsEnabled(Boolean(res?.success && res?.data))
      })
      .catch(() => {
        if (!cancelled) setSettlementAdjustmentsEnabled(false)
      })
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    if (!settlementShortfall || !settlementAdjustmentsEnabled) {
      setApplySettlementAdjustment(false)
    }
  }, [settlementShortfall, settlementAdjustmentsEnabled])

  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoiceAmount()
    }
  }, [isOpen, invoiceId])

  const loadInvoiceAmount = async () => {
    try {
      const response = await salesAPI.getInvoiceAmount?.(invoiceId) || await paymentsAPI.getInvoiceAmount?.(invoiceId)
      if (response?.data?.success && response.data.data) {
        const invoiceData = response.data.data
        setInvoice(invoiceData)
        // Auto-fill outstanding amount
        setFormData(prev => ({
          ...prev,
          amount: invoiceData.outstandingAmount || 0
        }))
      } else {
        // Fallback: try to get sale details
        const saleResponse = await salesAPI.getSale(invoiceId)
        if (saleResponse?.data?.success && saleResponse.data.data) {
          const sale = saleResponse.data.data
          const outstanding = (sale.grandTotal || sale.totalAmount || 0) - (sale.paidAmount || 0)
          setInvoice({
            invoiceNo: sale.invoiceNo,
            totalAmount: sale.grandTotal || sale.totalAmount || 0,
            paidAmount: sale.paidAmount || 0,
            outstandingAmount: outstanding
          })
          setFormData(prev => ({
            ...prev,
            amount: outstanding
          }))
        }
      }
    } catch (error) {
      console.error('Failed to load invoice amount:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to load invoice details')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // CRITICAL: Prevent duplicate submissions using ref (synchronous check)
    if (submissionInProgressRef.current || loading) {
      console.log('Payment submission already in progress, ignoring duplicate')
      toast.error('Please wait, payment is being processed...')
      return
    }

    if (!formData.amount || formData.amount <= 0) {
      toast.error('Payment amount must be greater than zero')
      return
    }

    if (!customerId && !invoiceId) {
      toast.error('Customer or Invoice is required')
      return
    }

    if ((formData.mode === 'CHEQUE' || formData.mode === 'ONLINE') && !formData.reference?.trim()) {
      toast.error('Reference number is required for Cheque and Bank Transfer payments')
      return
    }

    if (applySettlementAdjustment) {
      if (!settlementAdjustmentReason?.trim() || settlementAdjustmentReason.trim().length < 3) {
        toast.error('Enter a short reason for the settlement adjustment (at least 3 characters)')
        return
      }
      if (settlementShortfall <= 0) {
        toast.error('Settlement adjustment is not applicable for this amount')
        return
      }
    }

    // CONFIRMATION STEP: Show confirmation dialog for payments (overpayment allowed — excess becomes customer credit)
    if (!showConfirmation) {
      setShowConfirmation(true)
      return
    }

    // DUPLICATE PAYMENT CHECK: same customer + same amount + same day
    if (customerId) {
      try {
        const checkRes = await paymentsAPI.checkDuplicatePayment(
          customerId,
          parseFloat(formData.amount),
          formData.paymentDate || localDateString(new Date())
        )
        const hasDuplicate = checkRes?.data?.hasDuplicate || checkRes?.hasDuplicate
        if (hasDuplicate) {
          setShowDuplicateWarning(true)
          return
        }
      } catch (err) {
        console.warn('Duplicate check failed, proceeding:', err)
      }
    }

    await doSubmitPayment()
  }

  const doSubmitPayment = async () => {
    // Mark as in-progress immediately (synchronous)
    submissionInProgressRef.current = true
    setLoading(true)
    
    // Disable submit button to prevent double-click
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true
    }
    
    try {
      // Generate idempotency key for duplicate prevention
      const idempotencyKey = crypto.randomUUID()
      
      const paymentData = {
        saleId: invoiceId || null,
        customerId: customerId || null,
        amount: parseFloat(formData.amount),
        mode: formData.mode.toUpperCase(), // Ensure uppercase: CASH, CHEQUE, ONLINE, CREDIT
        reference: formData.reference || null,
        paymentDate: formData.paymentDate ? new Date(formData.paymentDate).toISOString() : new Date().toISOString()
      }
      if (applySettlementAdjustment && settlementShortfall > 0) {
        paymentData.settlementAdjustmentAmount = settlementShortfall
        paymentData.settlementAdjustmentReason = settlementAdjustmentReason.trim()
      }
      
      console.log('Submitting payment:', paymentData, 'Idempotency:', idempotencyKey)

      const response = await paymentsAPI.createPayment(paymentData, idempotencyKey)
      
      // Backend returns: { success: true, message: "...", data: { payment, invoice, customer } }
      if (response?.success) {
        const paymentResult = response?.data?.payment || response?.data
        const invoiceData = response?.data?.invoice
        const mode = paymentResult?.mode || formData.mode
        const amount = paymentResult?.amount || formData.amount
        const adj = response?.data?.settlementAdjustment?.amount
        const adjPart = adj > 0 ? ` + ${money(adj)} adjustment` : ''
        
        const statusMsg = invoiceData?.invoiceNo
          ? ` Invoice ${invoiceData.invoiceNo} status: ${invoiceData.status || invoiceData.paymentStatus || 'PENDING'}`
          : ''
        toast.success(`Payment recorded: ${money(amount)} cash${adjPart} (${mode})${statusMsg}`, { id: 'payment-success', duration: 5000 })

        if (typeof onReceiptPreview === 'function') {
          offerReceiptPreviewAfterPayment(paymentResult, onReceiptPreview)
        } else {
          const blocked = receiptOfferBlockedMessage(paymentResult)
          if (blocked) {
            toast(blocked, { duration: 7000, id: 'payment-receipt-blocked' })
          }
        }

        onPaymentSuccess?.(response?.data || response)
        onClose()
        
        // Reset form and confirmation
        setFormData({
          amount: 0,
          mode: 'CASH',
          reference: '',
          paymentDate: localDateString(new Date())
        })
        setShowConfirmation(false)
      } else {
        toast.error(response?.message || 'Failed to save payment', { id: 'payment-error' })
        setShowConfirmation(false) // Reset confirmation on error
      }
    } catch (error) {
      console.error('Failed to save payment:', error)
      console.log('Payment error:', {
        message: error?.message,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
        fullError: error
      })
      
      setShowConfirmation(false) // Reset confirmation on error
      
      // Skip if interceptor already showed the error (prevents double toast)
      if (error._handledByInterceptor) {
        return
      }
      
      // Handle specific error cases
      if (error.message?.includes('CONFLICT') || error.response?.status === 409) {
        toast.error('Another user updated this invoice. Please refresh and try again.', {
          id: 'payment-error',
          duration: 5000
        })
        if (onPaymentSuccess) {
          onPaymentSuccess(null) // Trigger refresh
        }
      } else if (error.response?.data?.message?.includes('already recorded') || 
                 error.response?.data?.message?.includes('already fully paid')) {
        // Duplicate payment or already paid - show specific message
        toast.error(error.response.data.message, { id: 'payment-error', duration: 6000 })
        // Close modal and refresh data
        onPaymentSuccess?.(null)
        onClose()
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMsg = error.response.data.errors.join(', ')
        toast.error(errorMsg, { id: 'payment-error' })
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message, { id: 'payment-error' })
      } else {
        toast.error('Failed to save payment', { id: 'payment-error' })
      }
    } finally {
      submissionInProgressRef.current = false
      setLoading(false)
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false
      }
    }
  }
  
  // Handle cancel confirmation
  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
  }

  const handleConfirmDuplicate = () => {
    setShowDuplicateWarning(false)
    doSubmitPayment()
  }

  if (!isOpen) return null

  return (
  <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold">
              {invoiceId ? 'Make Payment' : 'Add Balance Adjustment'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center"
            disabled={loading}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Info */}
        {invoice && (
          <div className="p-6 bg-gray-50 border-b">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Invoice Number:</span>
                <span className="font-medium">{invoice.invoiceNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Amount:</span>
                <span className="font-medium">{money(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Paid So Far:</span>
                <span className="font-medium text-blue-600">{money(invoice.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-semibold text-gray-700">Outstanding:</span>
                <span className="font-bold text-red-600">{money(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Payment Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={999999}
              inputMode="decimal"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
              disabled={loading}
            />
            {invoice && (
              <p className="mt-1 text-xs text-gray-500">
                Outstanding: {money(invoice.outstandingAmount)}
                {formData.amount > (Number(invoice.outstandingAmount) || 0) + 0.01 && !settlementShortfall && (
                  <span className="block mt-1 text-amber-600 font-medium">
                    Excess will be added as customer credit
                  </span>
                )}
              </p>
            )}
            {settlementAdjustmentsEnabled && settlementShortfall > 0 && (
              <div className="mt-3 p-3 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
                <p className="text-sm text-amber-900">
                  Cash is {money(settlementShortfall)} short of closing this invoice. You can record an authorized settlement adjustment (not counted as cash received).
                </p>
                <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={applySettlementAdjustment}
                    onChange={(e) => setApplySettlementAdjustment(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Close invoice with authorized adjustment of {money(settlementShortfall)}</span>
                </label>
                {applySettlementAdjustment && (
                  <textarea
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm min-h-[72px]"
                    placeholder="Reason for adjustment (required)"
                    value={settlementAdjustmentReason}
                    onChange={(e) => setSettlementAdjustmentReason(e.target.value)}
                    disabled={loading}
                    maxLength={500}
                  />
                )}
              </div>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode *
            </label>
            <select
              value={formData.mode}
              onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value }))}
              className="w-full px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
              disabled={loading}
            >
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="ONLINE">Online Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          {/* Reference - required for Cheque and Online Transfer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Reference (Cheque No / Transaction ID) {(formData.mode === 'CHEQUE' || formData.mode === 'ONLINE') && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              className="w-full px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder={(formData.mode === 'CHEQUE' || formData.mode === 'ONLINE') ? 'Required for Cheque/Bank Transfer' : 'Optional'}
              maxLength={200}
              disabled={loading}
            />
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Payment Date *
            </label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {!showConfirmation ? (
              // Initial form buttons
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  ref={submitButtonRef}
                  className="flex-1 px-4 py-2.5 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || formData.amount <= 0 || ((formData.mode === 'CHEQUE' || formData.mode === 'ONLINE') && !formData.reference?.trim())}
                >
                  {loading ? 'Processing...' : 'Continue'}
                </button>
              </>
            ) : (
              // Confirmation step buttons
              <div className="w-full space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Confirm Payment</span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    You are about to record <strong>{money(formData.amount)} cash received</strong>
                    {applySettlementAdjustment && settlementShortfall > 0 && (
                      <> plus <strong>{money(settlementShortfall)} authorized adjustment</strong> (applied {money((formData.amount || 0) + settlementShortfall)})</>
                    )}
                    {invoice && <> for invoice <strong>{invoice.invoiceNo}</strong></>}.
                  </p>
                  <p className="text-sm text-yellow-700 mt-2">
                    Payment Mode: <strong>{formData.mode}</strong>
                    {formData.mode === 'CHEQUE' && <span className="text-orange-600"> (Pending Clearance)</span>}
                  </p>
                  {invoice && formData.amount > (Number(invoice.outstandingAmount) || 0) + 0.01 && (
                    <p className="text-sm text-amber-700 mt-2 font-medium">
                      This payment exceeds outstanding by {money(formData.amount - (Number(invoice.outstandingAmount) || 0))}. The excess will be added as customer credit.
                    </p>
                  )}
                  <p className="text-xs text-yellow-600 mt-2">
                    This action cannot be easily undone. Please verify the details before confirming.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelConfirmation}
                    className="flex-1 px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={loading}
                  >
                    ← Go Back
                  </button>
                  <button
                    type="submit"
                    ref={submitButtonRef}
                    className="flex-1 px-4 py-2.5 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>Processing...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Confirm Payment</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>

    {/* Duplicate payment warning — same amount + same day */}
    <ConfirmDangerModal
      isOpen={showDuplicateWarning}
      onClose={() => setShowDuplicateWarning(false)}
      onConfirm={handleConfirmDuplicate}
      title="Possible Duplicate Payment"
      message={`A payment of ${money(formData.amount)} was already recorded for this customer today. Record another payment anyway?`}
      confirmLabel="Yes, Record Another"
    />
  </>
  )
}

export default PaymentModal

