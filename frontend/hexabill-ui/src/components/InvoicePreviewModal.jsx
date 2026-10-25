import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Printer, Download, Share2, Mail, MessageCircle, RotateCcw, MoreHorizontal, Hash } from 'lucide-react'
import { salesAPI } from '../services'
import { formatCurrency } from '../utils/currency'
import toast from 'react-hot-toast'
import { showToast } from '../utils/toast'
import PrintOptionsModal from './PrintOptionsModal'
import ConfirmDangerModal from './ConfirmDangerModal'
import { useBranding } from '../tenant/TenantBrandingContext'
import { useAuth } from '../hooks/useAuth'
import ChangeInvoiceNumberModal from '../features/sales/ChangeInvoiceNumberModal'
import { canChangeInvoiceNumber, isRenumberableSale } from '../utils/invoiceNumberChange'

const InvoicePreviewModal = ({ saleId, invoiceNo, customerPhone, onClose, onPrint, onNew, onReturnItems, onInvoiceNumberChanged }) => {
  const { user } = useAuth()
  const [renumberOpen, setRenumberOpen] = useState(false)
  const { currency = 'AED' } = useBranding()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const canRenumber = canChangeInvoiceNumber(user?.role) && !!invoice && isRenumberableSale(invoice)
  const [showPrintOptions, setShowPrintOptions] = useState(false)
  const [sheet, setSheet] = useState(null) // null | 'share' | 'more'
  const [dangerModal, setDangerModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    showInput: false,
    inputPlaceholder: '',
    defaultValue: '',
    onConfirm: () => { }
  })

  useEffect(() => {
    if (saleId) {
      loadInvoice()
    }
  }, [saleId])

  const loadInvoice = async () => {
    try {
      setLoading(true)
      const response = await salesAPI.getSale(saleId)
      if (response.success) {
        setInvoice(response.data)
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    setShowPrintOptions(true)
  }

  const handlePrintExecute = () => {
    if (onPrint) onPrint()
  }

  const handleDownload = async () => {
    try {
      setLoading(true)
      let pdfBlob
      try {
        pdfBlob = await salesAPI.getInvoicePdf(saleId, { layout: 'full' })
      } catch (apiError) {
        console.error('API Error:', apiError)
        if (!apiError?._handledByInterceptor) toast.error(apiError.message || 'Failed to generate PDF')
        setLoading(false)
        return
      }

      // Validate blob
      if (!pdfBlob || !(pdfBlob instanceof Blob)) {
        toast.error('Invalid PDF data received from server')
        setLoading(false)
        return
      }

      // Ensure it's a proper blob
      const blob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.style.display = 'none'
      const invoiceNumber = invoice?.invoiceNo || invoiceNo || saleId
      a.download = `invoice_${invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()

      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

      toast.success('Invoice downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to download invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppShare = async () => {
    try {
      setLoading(true)

      // Generate WhatsApp message
      const invoiceNo = invoice?.invoiceNo || `INV-${saleId}`
      const customerName = invoice?.customerName || 'Cash Customer'
      const grandTotal = invoice?.grandTotal || 0
      const date = invoice ? new Date(invoice.invoiceDate).toLocaleDateString() : new Date().toLocaleDateString()

      const message = `*Invoice ${invoiceNo}*\n\n` +
        `Customer: ${customerName}\n` +
        `Date: ${date}\n` +
        `Total: ${currency} ${grandTotal.toFixed(2)}\n\n` +
        `Please find the invoice attached.`

      // Encode message for WhatsApp URL
      const encodedMessage = encodeURIComponent(message)

      // Generate PDF blob first - ensure it's a PDF file, not a link
      let pdfBlob
      try {
        pdfBlob = await salesAPI.getInvoicePdf(saleId, { layout: 'full' })
      } catch (apiError) {
        console.error('PDF API Error:', apiError)
        if (!apiError?._handledByInterceptor) toast.error(apiError.message || 'Failed to generate PDF')
        return
      }

      // Validate it's a proper PDF blob, not a string/link
      if (!pdfBlob) {
        toast.error('No PDF data received from server')
        return
      }

      let blob
      if (pdfBlob instanceof Blob) {
        blob = pdfBlob
      } else if (typeof pdfBlob === 'string') {
        // If it's a string (link), that's an error - we need the PDF file
        toast.error('Received link instead of PDF file. PDF generation may have failed.')
        return
      } else {
        blob = new Blob([pdfBlob], { type: 'application/pdf' })
      }

      // Validate blob is actually a PDF file
      if (blob.size === 0) {
        toast.error('PDF is empty - invoice may not exist or PDF generation failed')
        return
      }

      // Verify it's actually a PDF by checking type
      if (blob.type && !blob.type.includes('pdf')) {
        toast.error('Invalid file type received. Expected PDF file.')
        return
      }

      // Download PDF file (not a link) so user can attach it
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.style.display = 'none'
      const invoiceNumber = invoice?.invoiceNo || invoiceNo || saleId
      a.download = `invoice_${invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()

      // Clean up download link
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

      // Open WhatsApp to customer when phone provided (#56)
      const { getWhatsAppShareUrl } = await import('../utils/whatsapp')
      const whatsappUrl = getWhatsAppShareUrl(message, customerPhone)
      window.open(whatsappUrl, '_blank')

      toast.success('PDF downloaded. WhatsApp opened. Please attach the downloaded PDF file.')
    } catch (error) {
      console.error('WhatsApp share error:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to share via WhatsApp. Please try downloading PDF manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailShare = async () => {
    try {
      const invoiceNo = invoice?.invoiceNo || `INV-${saleId}`
      const customerEmail = invoice?.customerEmail

      const executeSendEmail = async (email) => {
        setLoading(true)
        try {
          // Call backend API to send email
          const response = await salesAPI.sendInvoiceEmail(saleId, email)
          if (response.success) {
            toast.success('Invoice sent via email successfully')
          } else {
            toast.error(response.message || 'Failed to send email')
          }
        } catch (error) {
          console.error('Email send error:', error)
          // Fallback: Download PDF and use mailto link
          let pdfBlob
          try {
            pdfBlob = await salesAPI.getInvoicePdf(saleId, { layout: 'full' })
          } catch (apiError) {
            console.error('API Error:', apiError)
            if (!apiError?._handledByInterceptor) toast.error(apiError.message || 'Failed to generate PDF')
            return
          }

          const blob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' })
          const url = window.URL.createObjectURL(blob)

          const subject = encodeURIComponent(`Invoice ${invoiceNo}`)
          const body = encodeURIComponent(`Please find invoice ${invoiceNo} attached.`)
          const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`

          const a = document.createElement('a')
          a.href = url
          a.download = `invoice_${invoiceNo}.pdf`
          document.body.appendChild(a)
          a.click()

          window.location.href = mailtoLink

          setTimeout(() => {
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
          }, 100)

          showToast.info('Email client opened. Please attach the downloaded PDF')
        } finally {
          setLoading(false)
        }
      }

      if (!customerEmail) {
        setDangerModal({
          isOpen: true,
          title: 'Send Invoice to Email',
          message: 'Please provide the customer email address:',
          confirmLabel: 'Send Email',
          showInput: true,
          inputPlaceholder: 'customer@example.com',
          onConfirm: (val) => {
            if (!val?.trim()) {
              toast.error('Email address required')
              return
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(val.trim())) {
              toast.error('Please enter a valid email address')
              return
            }
            executeSendEmail(val.trim())
          }
        })
        return
      }

      await executeSendEmail(customerEmail)
    } catch (error) {
      console.error('Email share error:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to send email. Please download PDF and send manually.')
    }
  }

  const handleNewInvoice = () => {
    onClose()
    if (onNew) onNew()
    else navigate('/pos')
  }

  const handleReturnItems = () => {
    onClose()
    if (onReturnItems) onReturnItems(saleId)
    else navigate(`/returns/create?saleId=${saleId}`)
  }

  if (!saleId) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Invoice preview">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90dvh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 sm:p-6 border-b border-neutral-200">
          <h2 className="min-w-0 truncate text-lg sm:text-xl font-bold text-neutral-900">Invoice Preview - {invoice?.invoiceNo || invoiceNo || `#${saleId}`}</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-8">Loading invoice...</div>
          ) : invoice ? (
            <div className="space-y-4">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-neutral-600">Invoice Date:</p>
                  <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-600">Customer:</p>
                  <p className="font-medium">{invoice.customerName || 'Cash Customer'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Item</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Qty</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Price</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {invoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 sm:px-4 py-3">{item.productName}</td>
                      <td className="px-2 sm:px-4 py-3">{item.qty} {item.unitType}</td>
                      <td className="px-2 sm:px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-2 sm:px-4 py-3 font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-6 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {Number(invoice.discount) !== 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-{formatCurrency(invoice.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>VAT (5%):</span>
                    <span>{formatCurrency(invoice.vatTotal)}</span>
                  </div>
                  {Number(invoice.roundOff) !== 0 && (
                    <div className="flex justify-between">
                      <span>Round off:</span>
                      <span>{Number(invoice.roundOff) > 0 ? '+' : ''}{formatCurrency(invoice.roundOff)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(invoice.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500">Invoice not found</div>
          )}
        </div>

        {/* Actions: one primary (Share), one secondary (New sale), everything else behind two small sheets. */}
        <div className="flex items-center gap-2 p-4 sm:p-6 border-t border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={() => setSheet('share')}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
            aria-haspopup="dialog"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </button>
          <button
            type="button"
            onClick={handleNewInvoice}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            New sale
          </button>
          <button
            type="button"
            onClick={() => setSheet('more')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            aria-label="More actions"
            aria-haspopup="dialog"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {sheet && (
          <div className="absolute inset-0 z-10 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={sheet === 'share' ? 'Share invoice' : 'More actions'}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(null)} aria-hidden />
            <div className="relative rounded-t-xl bg-white p-2 pb-4 shadow-xl">
              <p className="px-3 pt-2 pb-1 text-sm font-semibold text-neutral-900">{sheet === 'share' ? 'Share invoice' : 'More actions'}</p>
              {(sheet === 'share'
                ? [
                  { key: 'whatsapp', label: 'WhatsApp', hint: customerPhone ? 'Send to the customer' : 'Opens WhatsApp', icon: MessageCircle, onClick: handleWhatsAppShare },
                  { key: 'email', label: 'Email', hint: 'Send the PDF by email', icon: Mail, onClick: handleEmailShare },
                  { key: 'pdf', label: 'Download PDF', hint: 'Save a copy on this device', icon: Download, onClick: handleDownload },
                  { key: 'print', label: 'Print', hint: 'Choose a layout and print', icon: Printer, onClick: handlePrint }
                ]
                : [
                  { key: 'return', label: 'Return items', hint: 'Create a sales return for this invoice', icon: RotateCcw, onClick: handleReturnItems },
                  ...(canRenumber ? [{ key: 'renumber', label: 'Change invoice number', hint: 'Owner or Admin only', icon: Hash, onClick: () => setRenumberOpen(true) }] : [])
                ]
              ).map(({ key, label, hint, icon: Icon, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSheet(null); onClick() }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-neutral-100"
                >
                  <Icon className="h-5 w-5 shrink-0 text-neutral-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-500">{hint}</span>
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => setSheet(null)} className="mt-1 min-h-11 w-full rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Print Options Modal */}
      {showPrintOptions && (
        <PrintOptionsModal
          saleId={saleId}
          invoiceNo={invoice?.invoiceNo || invoiceNo}
          onClose={() => setShowPrintOptions(false)}
          onPrint={handlePrintExecute}
        />
      )}

      <ConfirmDangerModal
        isOpen={dangerModal.isOpen}
        title={dangerModal.title}
        message={dangerModal.message}
        confirmLabel={dangerModal.confirmLabel}
        showInput={dangerModal.showInput}
        inputPlaceholder={dangerModal.inputPlaceholder}
        defaultValue={dangerModal.defaultValue}
        onConfirm={dangerModal.onConfirm}
        onClose={() => setDangerModal(prev => ({ ...prev, isOpen: false }))}
      />
      <ChangeInvoiceNumberModal
        isOpen={renumberOpen}
        sale={invoice ? { ...invoice, id: invoice.id ?? saleId } : null}
        onClose={() => setRenumberOpen(false)}
        onChanged={() => { loadInvoice(); onInvoiceNumberChanged?.() }}
      />
    </div>
  )
}

export default InvoicePreviewModal

