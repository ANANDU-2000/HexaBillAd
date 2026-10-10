import { Loader2 } from 'lucide-react'

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  )
}

const LoadingOverlay = ({ message = 'Loading...', show = true }) => {
  if (!show) return null

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-modal flex items-center justify-center bg-neutral-900/50">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-surface-border bg-white p-6 shadow-lg">
        <LoadingSpinner size="xl" className="text-primary-600" />
        <p className="text-sm font-medium text-neutral-700">{message}</p>
      </div>
    </div>
  )
}

const LoadingButton = ({ loading, children, className = '', ...props }) => {
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${className}`}
      disabled={loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}

const LoadingCard = ({ message = 'Loading...' }) => {
  return (
    <div role="status" className="rounded-lg border border-surface-border bg-white p-6">
      <div className="flex items-center justify-center space-x-3">
        <LoadingSpinner className="text-primary-600" />
        <span className="text-sm font-medium text-neutral-600">{message}</span>
      </div>
    </div>
  )
}

const PageLoading = ({ navigationAvailable = false }) => (
  <div role="status" aria-live="polite" className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 bg-surface px-4 py-8 text-sm text-neutral-600">
    <LoadingSpinner size="lg" className="text-primary-600 motion-reduce:animate-none" />
    <span>Loading this page…</span>
    {navigationAvailable && <span className="text-xs text-neutral-500">You can still use navigation.</span>}
  </div>
)

export { LoadingSpinner, LoadingOverlay, LoadingButton, LoadingCard, PageLoading }
