import { useState, useEffect, useRef } from 'react'
import { Printer, Download, X, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { paymentsAPI } from '../services'
import { formatCurrency } from '../utils/currency'
import { useBranding } from '../tenant/TenantBrandingContext'

/** Format date as dd-mm-yyyy for receipt and print. */
function toReceiptDate (d) {
  if (!d) return ''
  const date = new Date(d)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Payment receipt preview modal (proof of payment, not tax invoice).
 * - Single payment: one receipt with one invoice line.
 * - Multiple payments (multi-bill): one combined receipt with total received and a table of invoices/bills and amount applied to each.
 * Print is optional – only when the customer requests a copy.
 * Calls POST /payments/{id}/receipt or POST /payments/receipt/batch.
 */
export default function ReceiptPreviewModal ({ paymentIds = [], isOpen, onClose }) {
  const { currency: tenantCurrency = 'AED' } = useBranding()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null) // { detail, receiptNumber, receiptId } or { detail, receipts }
  const printRef = useRef(null)
  const [outputError, setOutputError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const printRetryAlternative = data?.detail?.isHistoricalSnapshot ? ' or download the PDF.' : '.'
  const [retry, setRetry] = useState(0)
  const paymentKey = JSON.stringify(paymentIds)
  const activePreview = useRef(null)
  activePreview.current = isOpen ? paymentKey : null

  useEffect(() => {
    if (!isOpen) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    const selectedIds = JSON.parse(paymentKey)
    if (!selectedIds?.length) {
      setData(null)
      setError('No payments selected. Please select at least one payment to generate a receipt.')
      setLoading(false)
      return
    }
    let cancelled = false
    setError(null)
    setOutputError(null)
    setData(null)
    setLoading(true)
    const fetchReceipt = async () => {
      try {
        const res = selectedIds.length === 1
          ? await paymentsAPI.generateReceipt(selectedIds[0])
          : await paymentsAPI.generateReceiptBatch(selectedIds)
        if (cancelled) return
        const payload = res?.data
        const detail = payload?.detail ?? (payload?.receiptNumber ? payload : null)
        if (res?.success && detail) {
          setData({ ...payload, detail })
          // Do not call onSuccess here — that reloads the ledger on every open and caused flash/refresh storms.
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
  }, [isOpen, paymentKey, retry])

  const handleDownload = async () => {
    const preview = paymentKey
    setOutputError(null)
    setDownloading(true)
    try {
      const blob = await paymentsAPI.getReceiptPdf(paymentIds, data.detail.documentFingerprint)
      if (activePreview.current !== preview) return
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = `receipt-${String(data.detail.receiptNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch (err) {
      if (activePreview.current === preview) setOutputError(err?.message || 'PDF download failed. Please try again.')
    } finally { setDownloading(false) }
  }

  const handlePrint = async () => {
    if (printing) return
    const preview = paymentKey
    if (!printRef.current) return
    const win = window.open('', '_blank')
    setOutputError(null)
    if (!win) {
      setOutputError(`The print window was blocked. Allow pop-ups for this site and try again${printRetryAlternative}`)
      return
    }
    setPrinting(true)
    try {
      const selectedIds = JSON.parse(preview)
      const res = selectedIds.length === 1
        ? await paymentsAPI.generateReceipt(selectedIds[0])
        : await paymentsAPI.generateReceiptBatch(selectedIds)
      if (activePreview.current !== preview) { win.close(); return }
      const payload = res?.data
      const fresh = payload?.detail ?? (payload?.receiptNumber ? payload : null)
      if (!res?.success || !fresh) throw new Error(res?.message || 'Receipt could not be refreshed. Try again.')
      if (fresh.documentFingerprint !== data.detail.documentFingerprint) {
        setData({ ...payload, detail: fresh })
        setOutputError('Receipt details changed. Review the updated preview, then print again.')
        win.close()
        return
      }
    } catch (err) {
      win.close()
      if (activePreview.current === preview) setOutputError(err?.message || 'Receipt could not be refreshed. Try again.')
      return
    } finally { setPrinting(false) }
    win.document.write(`
      <!DOCTYPE html><html><head><title>Payment Receipt</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 520px; margin: 0 auto; font-size: 14px; color: #111; }
        .receipt-preview { padding: 16px; }
        .company-document-header { text-align:center; margin-bottom:16px; color:#000; }
        .company-document-header p { margin:2px 0; overflow-wrap:anywhere; }
        .company-document-header img { display:block; margin:0 auto 8px; max-width:120px; height:56px; object-fit:contain; filter:grayscale(1); }
        .receipt-preview h1 { font-size: 20px; margin: 0 0 12px; font-weight: 700; }
        .receipt-separator { border-top: 1px solid #333 !important; }
        .receipt-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .receipt-table th, .receipt-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ddd; }
        .receipt-table th { font-weight: 600; }
        .receipt-table td:last-child, .receipt-table th:last-child,
        .receipt-table td:nth-child(3), .receipt-table th:nth-child(3) { text-align: right; }
        @media print { body { padding: 0; } .receipt-preview { border: none; box-shadow: none; } }
      </style></head><body>
      <div class="receipt-preview">
      ${printRef.current.innerHTML}
      </div>
      </body></html>
    `)
    win.document.close()
    win.focus()

    let closed = false
    const closePrintWindow = () => {
      if (closed) return
      closed = true
      try {
        win.removeEventListener('afterprint', closePrintWindow)
      } catch (_) { /* ignore */ }
      try {
        if (!win.closed) win.close()
      } catch (_) { /* ignore */ }
    }

    try {
      win.addEventListener('afterprint', closePrintWindow)
    } catch (_) { /* ignore */ }

    // Give the new document a moment to layout, then open the system print dialog.
    // Do NOT close immediately — that caused the open/close flash. afterprint closes;
    // long fallback only if afterprint never fires (some browsers).
    const printWhenReady = async () => {
      try {
        if (win.document.fonts?.ready) await win.document.fonts.ready
        if (win.closed || activePreview.current !== preview) { closePrintWindow(); return }
        win.print()
      } catch (_) {
        setOutputError(`Printing could not start. Please try again${printRetryAlternative}`)
        closePrintWindow()
        return
      }
      setTimeout(closePrintWindow, 60000)
    }
    if (win.document.readyState === 'complete') printWhenReady()
    else win.addEventListener('load', printWhenReady, { once: true })
  }

  const detail = data?.detail
  const displayCurrency = detail?.currency || tenantCurrency || 'AED'
  const footer = !loading && !error && detail && (
    <div className="flex flex-wrap gap-3">
      {outputError && <p role="alert" className="w-full rounded-md border border-error-border bg-error-bg p-3 text-sm text-error-fg">{outputError}</p>}
      {detail.isHistoricalSnapshot && (
        <button type="button" onClick={handleDownload} disabled={downloading}
          className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? 'Downloading…' : 'Download PDF'}
        </button>
      )}
      <button type="button" onClick={handlePrint} disabled={printing}
        className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        title="Print when customer requests">
        <Printer className="h-4 w-4" /> Print receipt
      </button>
      <button type="button" onClick={onClose}
        className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50">
        <X className="h-4 w-4" /> Close
      </button>
      <span className="w-full text-xs text-neutral-500">Optional — print when customer asks</span>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setData(null)
        setError(null)
        onClose()
      }}
      title="Payment Receipt / إيصال دفع"
      footer={footer}
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-error-bg border border-error-border px-4 py-3 text-error-fg text-sm">
          {error}
          <button type="button" onClick={() => setRetry(value => value + 1)} className="block mt-2 min-h-[44px] underline font-medium">Try again</button>
        </div>
      )}
      {!loading && !error && data?.detail && (
        <>
          {!detail.companyTrn && <p role="status" className="mb-3 text-sm text-amber-800">Add VAT TRN in Settings. This payment receipt is not a Tax Invoice.</p>}
          <div ref={printRef} className="receipt-preview rounded-lg border border-neutral-200 bg-white p-4 sm:p-6 text-left receipt-print-styles">
            {detail.bilingualMonochromeHeader && (
              <header className="company-document-header mb-4 text-center text-black">
                {detail.companyLogoDataUri && <img src={detail.companyLogoDataUri} alt="Company logo" className="mx-auto mb-2 h-14 max-w-[120px] object-contain" style={{ filter: 'grayscale(1)' }} />}
                <p className="text-lg font-semibold">{detail.companyName}</p>
                {detail.companyNameAr && <p dir="rtl" lang="ar">{detail.companyNameAr}</p>}
                <p className="text-sm">VAT TRN / <span lang="ar" dir="rtl">رقم التسجيل الضريبي</span>: {detail.companyTrn || ''}</p>
                {[detail.companyPhone, detail.companyEmail, detail.companyAddress].filter(Boolean).map((value, index) => <p key={index} className="text-sm break-words">{value}</p>)}
              </header>
            )}
            <h1 className="text-xl font-bold text-neutral-900 mb-2">PAYMENT RECEIPT</h1>
            <p className="text-sm text-neutral-700">Receipt No: {detail.receiptNumber}</p>
            <p className="text-sm text-neutral-700">Date: {toReceiptDate(detail.receiptDate)}</p>
            {detail.receiptEndDate && detail.receiptEndDate !== detail.receiptDate && (
              <p className="text-sm text-neutral-700">Payments through: {toReceiptDate(detail.receiptEndDate)}</p>
            )}
            {detail.legacyReconstruction && (
              <p className="mt-2 text-xs text-amber-800">Legacy receipt reconstructed from available records. Original company and invoice details were not saved.</p>
            )}
            {detail.paymentChangedSinceSnapshot && (
              <p className="mt-2 text-xs text-amber-800" role="status">This copy shows the saved receipt. The payment was changed afterward; review the ledger for its current details.</p>
            )}
            <div className="mt-4">
              <p className="text-sm font-medium text-neutral-700">Received From:</p>
              <p className="text-neutral-900 font-medium">{detail.receivedFrom}</p>
            </div>
            <p className="text-sm text-neutral-700 mt-2">Payment Method: {detail.paymentMethod}</p>
            {detail.reference && <p className="text-sm text-neutral-500 mt-0.5">Reference: {detail.reference}</p>}
            <div className="receipt-separator mt-4 mb-4 border-t border-neutral-300" aria-hidden="true" />
            {detail.invoices?.length > 0 && (
              <>
                <table className="receipt-table w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-neutral-400">
                      <th className="py-2 text-left font-semibold text-neutral-800">Invoice</th>
                      <th className="py-2 text-left font-semibold text-neutral-800">Date</th>
                      <th className="py-2 text-right font-semibold text-neutral-800">Invoice Total</th>
                      <th className="py-2 text-right font-semibold text-neutral-800">Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invoices.map((inv, i) => (
                      <tr key={i} className="border-b border-neutral-200">
                        <td className="py-2">{inv.invoiceNo}</td>
                        <td className="py-2">{toReceiptDate(inv.invoiceDate)}</td>
                        <td className="py-2 text-right">{formatCurrency(inv.invoiceTotal, displayCurrency)}</td>
                        <td className="py-2 text-right">{formatCurrency(inv.amountApplied, displayCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="receipt-separator mt-4 mb-4 border-t border-neutral-300" aria-hidden="true" />
              </>
            )}
            <p className="text-base font-bold text-neutral-900">
              Cash received: {formatCurrency(detail.amountReceived, displayCurrency)}
            </p>
            {Number(detail.settlementAdjustmentAmount) > 0 && (
              <div className="mt-1 text-sm text-neutral-800 space-y-0.5">
                <p>
                  Settlement adjustment: {formatCurrency(detail.settlementAdjustmentAmount, displayCurrency)}
                  {detail.settlementAdjustmentReason ? ` — ${detail.settlementAdjustmentReason}` : ''}
                </p>
                <p className="font-semibold">
                  Total applied to invoice: {formatCurrency(detail.amountPaid ?? detail.amountReceived, displayCurrency)}
                </p>
              </div>
            )}
            {Number(detail.settlementAdjustmentAmount) <= 0 && Number(detail.amountPaid) > Number(detail.amountReceived) && (
              <p className="text-sm text-neutral-700 mt-1">
                Total applied: {formatCurrency(detail.amountPaid, displayCurrency)}
              </p>
            )}
            {detail.amountInWords && (
              <p className="text-xs text-neutral-500 mt-1 italic">{detail.amountInWords}</p>
            )}
            <div className="mt-6 pt-4 border-t border-neutral-200 text-xs text-neutral-500">
              {detail.companyName && <p>{detail.companyName}</p>}
              {detail.companyAddress && <p>{detail.companyAddress}</p>}
              {detail.companyTrn && <p>TRN: {detail.companyTrn}</p>}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
