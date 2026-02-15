import { Link } from 'react-router-dom'
import { Shield, HelpCircle, MessageSquare, ExternalLink } from 'lucide-react'

/**
 * Super Admin – Settings (Help, Feedback, defaults).
 * Phase 2: Placeholder; add default trial days, country defaults later.
 */
const SuperAdminSettingsPage = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Platform Settings</h1>
        <div className="space-y-4">
          <Link
            to="/help"
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition"
          >
            <span className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-neutral-500" />
              <span className="font-medium text-neutral-900">Help & Support</span>
            </span>
            <ExternalLink className="h-4 w-4 text-neutral-400" />
          </Link>
          <Link
            to="/feedback"
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition"
          >
            <span className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-neutral-500" />
              <span className="font-medium text-neutral-900">Feedback</span>
            </span>
            <ExternalLink className="h-4 w-4 text-neutral-400" />
          </Link>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          Default trial days, country/currency defaults, and other platform settings will be added here.
        </p>
      </div>
    </div>
  )
}

export default SuperAdminSettingsPage
