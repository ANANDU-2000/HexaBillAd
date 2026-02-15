import { Plus, Receipt, UserPlus, FileText, Database, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAdminOrOwner } from '../utils/roles'

/**
 * Design lock: no gradient, border neutral-200, 2x2 grid on mobile, min-height 44px.
 * Icons: primary-600 or neutral-600; hover border-primary-300 bg-primary-50.
 */
const QuickActionsPanel = ({
  onBackup,
  backupLoading,
  dbStatus,
  lastBackup,
  onCreateCustomer,
  onOpenLedger,
}) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminOrOwner(user)

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4 md:p-6 h-full flex flex-col min-w-0">
      <h3 className="text-lg font-semibold text-primary-800 mb-4">Quick Actions</h3>

      <div className="grid grid-cols-2 md:grid-cols-1 gap-3 flex-1">
        <button
          onClick={() => navigate('/pos')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 min-h-[44px]"
        >
          <div className="flex items-center min-w-0">
            <Plus className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0" />
            <span className="font-medium text-primary-800 truncate">Create Bill</span>
          </div>
          <span className="text-xs text-primary-500 flex-shrink-0 ml-1">Ctrl+B</span>
        </button>

        <button
          onClick={() => navigate('/purchases')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 min-h-[44px]"
        >
          <div className="flex items-center min-w-0">
            <Receipt className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0" />
            <span className="font-medium text-primary-800 truncate">Create Purchase</span>
          </div>
          <span className="text-xs text-primary-500 flex-shrink-0 ml-1">Ctrl+U</span>
        </button>

        <button
          onClick={onCreateCustomer}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 min-h-[44px]"
        >
          <div className="flex items-center min-w-0">
            <UserPlus className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0" />
            <span className="font-medium text-primary-800 truncate">Create Customer</span>
          </div>
          <span className="text-xs text-primary-500 flex-shrink-0 ml-1">Ctrl+C</span>
        </button>

        <button
          onClick={onOpenLedger}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 min-h-[44px]"
        >
          <div className="flex items-center min-w-0">
            <FileText className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0" />
            <span className="font-medium text-primary-800 truncate">Customer Ledger</span>
          </div>
          <span className="text-xs text-primary-500 flex-shrink-0 ml-1">Ctrl+L</span>
        </button>

        {isAdmin && (
          <button
            onClick={onBackup}
            disabled={backupLoading}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 disabled:opacity-50 min-h-[44px] md:col-span-2"
          >
            <div className="flex items-center min-w-0">
              <Database className="w-5 h-5 text-primary-600 mr-2 flex-shrink-0" />
              <span className="font-medium text-primary-800 truncate">Run Backup</span>
            </div>
            <span className="text-xs text-primary-500 flex-shrink-0 ml-1">Ctrl+K</span>
          </button>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-primary-200 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-primary-600">DB Status:</span>
          <div className="flex items-center">
            {dbStatus ? (
              <>
                <CheckCircle className="w-4 h-4 text-primary-600 mr-1" />
                <span className="text-primary-600">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-primary-500 mr-1" />
                <span className="text-primary-500">Disconnected</span>
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary-600">Last Backup:</span>
            <div className="flex items-center text-primary-500">
              <Clock className="w-3 h-3 mr-1" />
              <span>{lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuickActionsPanel
