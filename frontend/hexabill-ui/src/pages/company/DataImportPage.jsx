/**
 * Data Import / Migrate from old app
 * One place for: Restore backup, Import Excel (products), future: customers/sales/PDF
 * Mobile-friendly, clear icons and CTAs.
 */
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Database,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Receipt,
  HelpCircle
} from 'lucide-react'
import { isAdminOrOwner } from '../../utils/roles'
import { useAuth } from '../../hooks/useAuth'

const DataImportPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminOrOwner(user)

  const cards = [
    {
      title: 'Restore from HexaBill backup',
      description: 'Restore all your data (bills, customers, products, settings) from a backup file. Use this when migrating from another HexaBill instance or recovering from a backup.',
      icon: Database,
      href: '/backup',
      label: 'Open Backup & Restore',
      primary: true
    },
    {
      title: 'Import products from Excel',
      description: 'Upload an Excel file to import products (name, SKU, price, stock). Same data as your old app table or Excel export.',
      icon: FileSpreadsheet,
      href: '/products',
      label: 'Go to Products → Import Excel',
      primary: false
    },
    {
      title: 'Bills, invoices & PDF',
      description: 'Existing bills and invoices are stored in HexaBill. Use Reports and Sales Ledger to view and export. PDF export is available per invoice.',
      icon: Receipt,
      href: '/sales-ledger',
      label: 'Open Sales Ledger',
      primary: false
    },
    {
      title: 'Import sales ledger (Excel / CSV)',
      description: 'Upload a table from your old app (Invoice No, Customer Name, Payment Type, Date, Net Sales, VAT). We create customers, invoices, and payments so balances and ledgers stay in sync.',
      icon: FileSpreadsheet,
      href: '/import/sales-ledger',
      label: 'Import Sales Ledger',
      primary: true
    }
  ]

  if (!isAdmin) {
    return (
      <div className="p-4 w-full">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <HelpCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-amber-900">Access required</h2>
            <p className="text-sm text-amber-800 mt-1">Data import and backup restore are available to Admins and Owners. Ask your admin or go to Settings for user roles.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden max-w-full">
      <div className="w-full px-4 py-6 sm:py-8">
        {/* Header - works on mobile and desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Upload className="h-8 w-8 sm:h-9 sm:w-9 text-primary-600" aria-hidden />
              Import & migrate data
            </h1>
            <p className="mt-1 text-gray-600 text-sm sm:text-base">
              Bring data from your old app: backup restore, Excel, and more. Same bills, tables, and data in HexaBill.
            </p>
          </div>
        </div>

        {/* Cards - responsive, touch-friendly */}
        <div className="space-y-4">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:border-primary-300 transition-colors"
              >
                <div
                  className="p-4 sm:p-5 cursor-pointer"
                  onClick={() => navigate(card.href)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(card.href)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${card.title}, ${card.label}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary-600" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 text-lg">{card.title}</h2>
                      <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                      <span
                        className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${card.primary ? 'text-primary-600' : 'text-gray-600'}`}
                      >
                        {card.label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Short tips */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <h3 className="font-semibold text-blue-900 text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tip
          </h3>
          <p className="mt-1 text-sm text-blue-800">
            For a full copy of your old app (all tables, Excel, PDF data): create a backup in the old system if it supports export, then re-enter or import the main lists (products, customers) here. Use <strong>Backup & Restore</strong> to save and restore HexaBill data anytime.
          </p>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          PDF/HTML import for sales ledger is planned; for now use Excel or CSV export from your old app and import here.
        </p>
      </div>
    </div>
  )
}

export default DataImportPage

