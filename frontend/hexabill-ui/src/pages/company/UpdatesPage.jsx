import React from 'react'
import { MessageCircle, Mail, Sparkles, ArrowRight, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBranding } from '../../contexts/TenantBrandingContext'

const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || ''
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@hexabill.com'

const UpdatesPage = () => {
  const { companyName } = useBranding()

  const whatsappUrl = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`
    : null

  const whatsappDisplay = SUPPORT_WHATSAPP || 'Not configured'

  const latestUpdates = [
    { title: 'Alerts & Notifications', desc: 'Low stock, overdue invoices, and balance alerts in one place. Check the bell icon in the header.', path: '/dashboard' },
    { title: 'Outstanding & Pending Bills', desc: 'View and export pending bills and overdue invoices from Reports → Outstanding Bills.', path: '/reports?tab=outstanding' },
    { title: 'Sales Ledger', desc: 'Full sales ledger with payments, pending amounts, and net balance. Filter by date and customer.', path: '/sales-ledger' },
    { title: 'Customer Ledger', desc: 'Per-customer ledger and balance. Track debt and payments.', path: '/ledger' },
    { title: 'Backup & Restore', desc: 'Download backup and restore your data anytime. Available in Settings area.', path: '/backup' },
    { title: 'Import Data', desc: 'Import products from Excel. More import options (sales ledger from PDF/Excel) coming soon.', path: '/import' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden max-w-full">
      <div className="w-full px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary-500" aria-hidden />
            Updates & Support
          </h1>
          <p className="mt-1 text-gray-600">
            Latest features and how to get help for {companyName || 'HexaBill'}.
          </p>
        </div>

        {/* What's New */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
            What&apos;s New
          </h2>
          <ul className="space-y-4">
            {latestUpdates.map((item, idx) => (
              <li key={idx}>
                <Link
                  to={item.path}
                  className="block p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{item.desc}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Contact Admin / Support */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Admin / Support</h2>
          <p className="text-gray-600 text-sm mb-4">
            Need help or want to report an issue? Use one of the options below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 block">WhatsApp</span>
                  <span className="text-sm text-gray-600">{whatsappDisplay}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
              </a>
            )}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <span className="font-medium text-gray-900 block">Email</span>
                <span className="text-sm text-gray-600 break-all">{SUPPORT_EMAIL}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
            </a>
          </div>
          {!whatsappUrl && (
            <p className="mt-3 text-xs text-gray-500">
              To enable WhatsApp contact, set <code className="bg-gray-100 px-1 rounded">VITE_SUPPORT_WHATSAPP</code> in your environment (e.g. 971501234567).
            </p>
          )}
        </section>

        <div className="mt-6 text-center">
          <Link to="/help" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
            Help & FAQ →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default UpdatesPage

