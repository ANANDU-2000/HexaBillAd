/**
 * Import Sales Ledger from Excel/CSV (ZAYOGA-style: Invoice No, Customer, Payment Type, Date, Net Sales, VAT, etc.)
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Loader2, Table2 } from 'lucide-react'
import { importAPI } from '../../services'
import toast from 'react-hot-toast'

const FIELDS = [
  { key: 'invoiceNo', label: 'Invoice No', required: true },
  { key: 'customerName', label: 'Customer Name', required: true },
  { key: 'paymentType', label: 'Payment Type', required: false },
  { key: 'paymentDate', label: 'Payment Date', required: false },
  { key: 'netSales', label: 'Net Sales', required: false },
  { key: 'vat', label: 'VAT', required: false },
  { key: 'sales', label: 'Sales', required: false },
  { key: 'discount', label: 'Discount', required: false },
  { key: 'cost', label: 'Cost', required: false }
]

export default function SalesLedgerImportPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setParsed(null)
    setResult(null)
    setMapping({})
  }

  const handleParse = useCallback(async () => {
    if (!file) {
      toast.error('Select a file first')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await importAPI.parseSalesLedger(file, 500)
      if (res?.success && res?.data) {
        setParsed(res.data)
        if (res.data.error) {
          toast.error(res.data.error)
        } else {
          toast.success(`Parsed ${res.data.rows?.length ?? 0} rows. Map columns and click Import.`)
        }
      } else {
        toast.error(res?.message || 'Parse failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }, [file])

  const handleApply = useCallback(async () => {
    if (!parsed?.rows?.length) {
      toast.error('No rows to import. Parse a file first.')
      return
    }
    const invoiceNoCol = mapping.invoiceNo
    const customerNameCol = mapping.customerName
    if (invoiceNoCol === undefined || invoiceNoCol === '' || customerNameCol === undefined || customerNameCol === '') {
      toast.error('Map at least Invoice No and Customer Name columns')
      return
    }
    const columnMapping = {}
    FIELDS.forEach(({ key }) => {
      const v = mapping[key]
      if (v !== undefined && v !== '') columnMapping[key] = parseInt(v, 10)
    })
    setApplying(true)
    setResult(null)
    try {
      const res = await importAPI.applySalesLedger({
        columnMapping,
        rows: parsed.rows,
        skipDuplicates: true
      })
      if (res?.success && res?.data) {
        setResult(res.data)
        toast.success(res.message || 'Import completed')
      } else {
        toast.error(res?.message || 'Import failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Import failed')
    } finally {
      setApplying(false)
    }
  }, [parsed, mapping])

  const previewRows = parsed?.rows?.slice(0, 15) ?? []

  const handleDownloadErrors = () => {
    if (!result?.errors?.length) return
    const text = result.errors.map((err, i) => `Row ${i + 1}: ${err}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-errors.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Errors downloaded')
  }

  const handleCopyErrors = () => {
    if (!result?.errors?.length) return
    const text = result.errors.map((err, i) => `Row ${i + 1}: ${err}`).join('\n')
    navigator.clipboard.writeText(text).then(() => toast.success('Errors copied to clipboard'))
  }

  return (
    <div className="min-h-screen bg-neutral-50 overflow-x-hidden max-w-full">
      <div className="w-full px-4 py-6 sm:py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/import')}
            className="text-sm text-primary-600 hover:text-primary-800 mb-2"
          >
            ← Back to Import
          </button>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary-600" />
            Import Sales Ledger
          </h1>
          <p className="mt-1 text-neutral-600 text-sm">
            Workflow: Upload → Map columns → Import. Upload Excel or CSV from your old app (e.g. Invoice No, Customer Name, Payment Type, Date, Net Sales, VAT). We create customers, invoices, and payments.
          </p>
        </div>

        {/* Step 1: Upload */}
        <section className="bg-white rounded-lg border border-neutral-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            1. Upload file
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700"
            />
            <button
              type="button"
              onClick={handleParse}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
              {loading ? 'Parsing…' : 'Parse file'}
            </button>
          </div>
          {parsed?.error && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {parsed.error}
            </p>
          )}
        </section>

        {/* Step 2: Map columns + Preview */}
        {parsed && !parsed.error && parsed.headers?.length > 0 && (
          <section className="bg-white rounded-lg border border-neutral-200 p-4 sm:p-6 mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              2. Map columns
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              Choose which file column matches each HexaBill field. Invoice No and Customer Name are required.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {FIELDS.map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    className="w-full rounded border border-neutral-300 text-sm py-1.5"
                  >
                    <option value="">— Skip —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={i}>
                        Col {i}: {h || `(empty)`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-medium text-neutral-700 mb-2">Preview (first 15 rows)</h3>
            <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-xs min-w-full">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    {parsed.headers.slice(0, 12).map((h, i) => (
                      <th key={i} className="px-2 py-2 text-left font-medium text-neutral-700 whitespace-nowrap">
                        {h || `Col${i}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-t border-neutral-100">
                      {row.slice(0, 12).map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 whitespace-nowrap text-neutral-600">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {applying ? 'Importing…' : `Import ${parsed.rows?.length ?? 0} rows`}
              </button>
            </div>
          </section>
        )}

        {/* Result */}
        {result && (
          <section className="bg-white rounded-lg border border-green-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import result
            </h2>
            <ul className="text-sm text-neutral-700 space-y-1">
              <li>Sales created: <strong>{result.salesCreated}</strong></li>
              <li>Customers created: <strong>{result.customersCreated}</strong></li>
              <li>Payments created: <strong>{result.paymentsCreated}</strong></li>
              <li>Skipped (duplicates): <strong>{result.skipped}</strong></li>
            </ul>
            {result.errors?.length > 0 && (
              <div className="mt-3 text-sm text-red-600">
                <span className="font-medium">Errors ({result.errors.length}):</span>
                <ul className="list-disc pl-5 mt-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 10 && <li>… and {result.errors.length - 10} more</li>}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={handleDownloadErrors} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded border border-neutral-300 text-sm hover:bg-neutral-200">
                    Download errors
                  </button>
                  <button type="button" onClick={handleCopyErrors} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded border border-neutral-300 text-sm hover:bg-neutral-200">
                    Copy errors
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/sales-ledger')}
              className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-800 font-medium text-sm"
            >
              Open Sales Ledger
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

