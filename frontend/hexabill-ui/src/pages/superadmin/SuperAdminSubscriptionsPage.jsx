import { Link } from 'react-router-dom'
import { DollarSign, Building2 } from 'lucide-react'

/**
 * Super Admin – Subscriptions overview.
 * Phase 2: Placeholder; full list by company (plan, status, end date, MRR) to be built.
 */
const SuperAdminSubscriptionsPage = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-8 text-center">
          <div className="inline-flex p-4 rounded-xl bg-blue-50 text-blue-600 mb-4">
            <DollarSign className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Subscriptions</h1>
          <p className="text-neutral-600 mb-6">
            Platform-wide subscription view (by company, plan, status, MRR) will be built here.
          </p>
          <Link
            to="/superadmin/tenants"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Building2 className="h-4 w-4" />
            View Companies (subscription in company detail)
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminSubscriptionsPage
