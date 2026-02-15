import { useState, useEffect } from 'react'
import { X, Printer, Download, Share2, Mail, MessageCircle } from 'lucide-react'
import { salesAPI } from '../services'
import { formatCurrency } from '../utils/currency'
import toast from 'react-hot-toast'
import PrintOptionsModal from './PrintOptionsModal'

const InvoicePreviewModal = ({ saleId, invoiceNo, onClose, onPrint, onNew }) => {
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const [showPrintOptions, setShowPrintOptions] = useState(false)

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
      toast.error('Failed to load invoice')
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
        pdfBlob = await salesAPI.getInvoicePdf(saleId)
      } catch (apiError) {
        console.error('API Error:', apiError)
        toast.error(apiError.message || 'Failed to generate PDF')
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
      toast.error(error.message || 'Failed to download invoice. Please try again.')
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
        `Total: AED ${grandTotal.toFixed(2)}\n\n` +
        `Please find the invoice attached.`
      
      // Encode message for WhatsApp URL
      const encodedMessage = encodeURIComponent(message)
      
      // Generate PDF blob first - ensure it's a PDF file, not a link
      let pdfBlob
      try {
        pdfBlob = await salesAPI.getInvoicePdf(saleId)
      } catch (apiError) {
        console.error('PDF API Error:', apiError)
        toast.error(apiError.message || 'Failed to generate PDF')
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
      
      // Open WhatsApp Web with message (user will attach the downloaded PDF file)
      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
      window.open(whatsappUrl, '_blank')
      
      toast.success('PDF downloaded. WhatsApp opened. Please attach the downloaded PDF file.')
    } catch (error) {
      console.error('WhatsApp share error:', error)
      toast.error(error.message || 'Failed to share via WhatsApp. Please try downloading PDF manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailShare = async () => {
    try {
      const invoiceNo = invoice?.invoiceNo || `INV-${saleId}`
      
      // Prompt for email address
      const customerEmail = invoice?.customerEmail || prompt('Enter customer email address:')
      
      if (!customerEmail) {
        toast.error('Email address required')
        return
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(customerEmail)) {
        toast.error('Please enter a valid email address')
        return
      }
      
      setLoading(true)
      
      try {
        // Call backend API to send email
        const response = await salesAPI.sendInvoiceEmail(saleId, customerEmail)
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
          pdfBlob = await salesAPI.getInvoicePdf(saleId)
        } catch (apiError) {
          console.error('API Error:', apiError)
          toast.error(apiError.message || 'Failed to generate PDF')
          return
        }
        
        // Validate blob
        if (!pdfBlob || !(pdfBlob instanceof Blob)) {
          toast.error('Invalid PDF data received from server')
          return
        }
        
        const blob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        
        // Create mailto link with subject and body
        const subject = encodeURIComponent(`Invoice ${invoiceNo}`)
        const body = encodeURIComponent(`Please find invoice ${invoiceNo} attached.`)
        const mailtoLink = `mailto:${customerEmail}?subject=${subject}&body=${body}`
        
        // Download PDF first
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice_${invoiceNo}.pdf`
        document.body.appendChild(a)
        a.click()
        
        // Open email client
        window.location.href = mailtoLink
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }, 100)
        
        toast.info('Email client opened. Please attach the downloaded PDF')
      }
    } catch (error) {
      console.error('Email share error:', error)
      toast.error('Failed to send email. Please download PDF and send manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleNewInvoice = () => {
    if (onNew) onNew()
    onClose()
  }

  if (!saleId) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Invoice Preview - {invoice?.invoiceNo || invoiceNo || `#${saleId}`}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">Loading invoice...</div>
          ) : invoice ? (
            <div className="space-y-4">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Invoice Date:</p>
                  <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Customer:</p>
                  <p className="font-medium">{invoice.customerName || 'Cash Customer'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">{item.productName}</td>
                      <td className="px-4 py-3">{item.qty} {item.unitType}</td>
                      <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(item.lineTotal)}</td>
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
                  <div className="flex justify-between">
                    <span>VAT (5%):</span>
                    <span>{formatCurrency(invoice.vatTotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(invoice.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Invoice not found</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleNewInvoice}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            New Invoice
          </button>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              title="Download PDF"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
              title="Share via WhatsApp"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </button>
            <button
              onClick={handleEmailShare}
              className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              title="Send via Email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </button>
          </div>
        </div>
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
    </div>
  )
}

export default InvoicePreviewModal

