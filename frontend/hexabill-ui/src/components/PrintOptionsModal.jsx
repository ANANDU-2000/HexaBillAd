import { useState, useRef } from 'react'
import { X, Printer, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { salesAPI } from '../services'

const DEFAULT_PRINT_FORMAT_KEY = 'hexabill_default_print_format'
const VALID_FORMATS = ['A4', 'A5', '80mm', '58mm']

const getDefaultPrintFormat = () => {
  try {
    const saved = localStorage.getItem(DEFAULT_PRINT_FORMAT_KEY)
    if (saved && VALID_FORMATS.includes(saved)) return saved
  } catch (_) {}
  return 'A4'
}

const PrintOptionsModal = ({ saleId, invoiceNo, onClose, onPrint }) => {
  const [format, setFormat] = useState(getDefaultPrintFormat)
  const [copies, setCopies] = useState(1)
  const [printer, setPrinter] = useState('default')
  const [orientation, setOrientation] = useState('portrait')
  const [printing, setPrinting] = useState(false)
  const printHandledRef = useRef(false)

  const downloadPdfBlob = (blob, filename, message = 'PDF downloaded. Open it to print.') => {
    const blobUrl = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' }))
    try {
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(message)
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    }
  }

  /** Print via hidden iframe — avoids pop-up blockers (window.open before fetch). */
  const printPdfBlob = (blob, filename) =>
    new Promise((resolve) => {
      let settled = false
      const pdfUrl = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' }))
      const iframe = document.createElement('iframe')
      iframe.setAttribute('title', 'Print document')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;opacity:0;pointer-events:none'
      iframe.src = pdfUrl
      document.body.appendChild(iframe)

      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe)
          URL.revokeObjectURL(pdfUrl)
        }, 10000)
      }

      const finish = (mode) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(mode)
      }

      const fallbackDownload = () => {
        downloadPdfBlob(blob, filename)
        finish('download')
      }

      const trigger = () => {
        if (settled) return
        try {
          const win = iframe.contentWindow
          if (!win) {
            fallbackDownload()
            return
          }
          win.focus()
          win.print()
          toast.success('Print dialog opened')
          finish('print')
        } catch (e) {
          console.error('Print trigger error:', e)
          fallbackDownload()
        }
      }

      iframe.onload = () => setTimeout(trigger, 600)
      // Some browsers never fire iframe onload for application/pdf.
      setTimeout(() => { if (!settled) trigger() }, 2500)
    })

  const handlePrint = async () => {
    if (!saleId) {
      toast.error('Invalid invoice. Cannot print.')
      return
    }
    printHandledRef.current = false
    setPrinting(true)
    try {
      const pdfOptions = { format, layout: 'body' }
      const blob = await salesAPI.getInvoicePdf(saleId, pdfOptions)
      if (!blob || (blob instanceof Blob && blob.size === 0)) {
        toast.error('PDF could not be generated')
        setPrinting(false)
        return
      }
      printHandledRef.current = true
      const safeName = `invoice-${String(invoiceNo || saleId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      await printPdfBlob(blob, safeName)
      if (onPrint) onPrint()
      onClose()
      try { localStorage.setItem(DEFAULT_PRINT_FORMAT_KEY, format) } catch (_) {}
    } catch (error) {
      console.error('Print error:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to generate PDF')
    } finally {
      setPrinting(false)
    }
  }

  const handleDeliveryNote = async () => {
    if (!saleId) {
      toast.error('Invalid invoice. Cannot print delivery note.')
      return
    }
    setPrinting(true)
    try {
      const blob = await salesAPI.getDeliveryNotePdf(saleId, { format: format === 'A5' ? 'A5' : 'A4', layout: 'body' })
      if (!blob || (blob instanceof Blob && blob.size === 0)) {
        toast.error('Delivery note could not be generated')
        setPrinting(false)
        return
      }
      const safeName = `delivery-note-${String(invoiceNo || saleId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      await printPdfBlob(blob, safeName)
      onClose()
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to generate delivery note')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between pl-6 pr-2 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Print Options</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection - A4, A5, 80mm, 58mm (Gulf VAT compliant) */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Print format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  format === 'A4'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <FileText className="h-8 w-8 mx-auto mb-2 text-primary-600" />
                <span className="font-medium">A4 Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('A5')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  format === 'A5'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <FileText className="h-8 w-8 mx-auto mb-2 text-primary-500" />
                <span className="font-medium">A5 Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('80mm')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  format === '80mm'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Printer className="h-8 w-8 mx-auto mb-2 text-success" />
                <span className="font-medium">80mm Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('58mm')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  format === '58mm'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Printer className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <span className="font-medium">58mm Receipt</span>
              </button>
            </div>
          </div>

          {/* Copies - A4/A5 only */}
          {(format === 'A4' || format === 'A5') && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Copies
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-md"
              />
            </div>
          )}

          {/* Printer Selection (for future use) */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Printer
            </label>
            <select
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-md"
            >
              <option value="default">Default Printer</option>
              <option value="browser">Browser Print Dialog</option>
            </select>
          </div>

          {/* Invoice Info */}
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600">Invoice:</p>
            <p className="font-medium text-neutral-900">{invoiceNo || `#${saleId}`}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end p-6 border-t border-neutral-200 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleDeliveryNote}
            disabled={printing}
            className="inline-flex items-center px-4 min-h-[44px] bg-warning text-white rounded-md hover:bg-amber-700 disabled:opacity-50 mr-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Delivery Note
          </button>
          <button
            onClick={onClose}
            disabled={printing}
            className="px-4 min-h-[44px] text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center px-4 min-h-[44px] bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {printing ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Generating…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintOptionsModal

