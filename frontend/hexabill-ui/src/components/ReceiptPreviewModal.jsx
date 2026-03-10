import { useState, useEffect, useRef } from 'react'
import { Printer, X, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { paymentsAPI } from '../services'
import { formatCurrency } from '../utils/currency'

/**
 * Payment receipt preview modal (proof of payment, not tax invoice).
 * Calls POST /payments/{id}/receipt or POST /payments/receipt/batch and displays the receipt.
 */
export default function ReceiptPreviewModal ({ paymentIds = [], isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null) // { detail, receiptNumber, receiptId } or { detail, receipts }
  const printRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    if (!paymentIds?.length) {
      setData(null)
      setError('No payments selected. Please select at least one payment to generate a receipt.')
      setLoading(false)
      return
    }
    let cancelled = false
    setError(null)
    setLoading(true)
    const fetchReceipt = async () => {
      try {
        const res = paymentIds.length === 1
          ? await paymentsAPI.generateReceipt(paymentIds[0])
          : await paymentsAPI.generateReceiptBatch(paymentIds)
        if (cancelled) return
        if (res?.success && res?.data) {
          setData(res.data)
          onSuccess?.()
        } else {
          setError(res?.message || 'Receipt could not be loaded. Please try again or contact support.')
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.response?.data?.message || err?.message
          setError(msg || 'Receipt could not be loaded. Please try again or contact support.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchReceipt()
    return () => { cancelled = true }
  }, [isOpen, paymentIds, onSuccess])

  const handlePrint = () => {
    if (!printRef.current) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head><title>Payment Receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; }
        .receipt { border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .meta { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
        .amount { font-size: 20px; font-weight: 700; margin: 16px 0; }
        .words { font-style: italic; color: #374151; margin: 8px 0; }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 300)
  }

  const detail = data?.detail

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setData(null)
        setError(null)
        onClose()
      }}
      title="Payment Receipt / إيصال دفع"
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}
      {!loading && !error && data?.detail && (
        <>
          <div ref={printRef} className="receipt-preview rounded-lg border border-gray-200 bg-white p-6 text-left">
            <h1 className="text-lg font-bold text-gray-900">PAYMENT RECEIPT / إيصال دفع</h1>
            <p className="text-sm text-gray-500 mt-1">Receipt No: {detail.receiptNumber}</p>
            <p className="text-sm text-gray-500">Date: {new Date(detail.receiptDate).toLocaleDateString()}</p>
            <div className="mt-4 border-t pt-4">
              <p className="font-semibold text-gray-900">{detail.companyName}</p>
              {detail.companyNameAr && <p className="text-sm text-gray-600">{detail.companyNameAr}</p>}
              {detail.companyAddress && <p className="text-sm text-gray-500">{detail.companyAddress}</p>}
              {detail.companyTrn && <p className="text-sm text-gray-500">TRN: {detail.companyTrn}</p>}
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Received From / المستلم من</p>
              <p className="font-medium text-gray-900">{detail.receivedFrom}</p>
              {detail.customerTrn && <p className="text-sm text-gray-500">TRN: {detail.customerTrn}</p>}
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Amount Received / المبلغ المستلم</p>
              <p className="amount text-indigo-600">{formatCurrency(detail.amountReceived)}</p>
              <p className="words">{detail.amountInWords}</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">Payment method: {detail.paymentMethod}</p>
            {detail.reference && <p className="text-sm text-gray-500">Reference: {detail.reference}</p>}
            {detail.invoices?.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 text-left font-medium text-gray-700">Invoice</th>
                    <th className="py-2 text-left font-medium text-gray-700">Date</th>
                    <th className="py-2 text-right font-medium text-gray-700">Total</th>
                    <th className="py-2 text-right font-medium text-gray-700">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.invoices.map((inv, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5">{inv.invoiceNo}</td>
                      <td className="py-1.5">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                      <td className="py-1.5 text-right">{formatCurrency(inv.invoiceTotal)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(inv.amountApplied)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(detail.previousBalance != null || detail.remainingBalance != null) && (
              <div className="mt-4 pt-4 border-t text-sm">
                {detail.previousBalance != null && <p>Previous balance: {formatCurrency(detail.previousBalance)}</p>}
                <p className="font-medium">Amount paid: {formatCurrency(detail.amountPaid)}</p>
                {detail.remainingBalance != null && <p>Remaining balance: {formatCurrency(detail.remainingBalance)}</p>}
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
