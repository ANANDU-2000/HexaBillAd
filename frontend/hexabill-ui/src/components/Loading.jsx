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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-surface-border bg-white p-6 shadow-sm">
        <LoadingSpinner size="xl" className="text-primary-600" />
        <p className="text-sm font-medium text-neutral-700">{message}</p>
      </div>
    </div>
  )
}

const LoadingButton = ({ loading, children, className = '', ...props }) => {
  // A caller's background class replaces the primary fill. Before, both classes applied and the CSS order
  // decided the colour (DC-04): indigo, amber and slate overrides lost to the primary blue.
  const hasBgOverride = /(^|\s)bg-/.test(className)
  const fill = hasBgOverride ? '' : 'bg-primary-600 hover:bg-primary-700'
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${fill} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${className}`}
      disabled={loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}

const SkeletonBlock = ({ className = '' }) => <div className={`hb-skeleton ${className}`} aria-hidden="true" />

const LoadingCard = ({ message = 'Loading...' }) => {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-surface-border bg-white p-4">
      <span className="sr-only">{message}</span>
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-4/5" />
      </div>
    </div>
  )
}

/** Page placeholder that mirrors the real layout (title, 4 KPI cards, list rows) so the page does not jump when data arrives. */
const PageLoading = ({ navigationAvailable = false }) => (
  <div role="status" aria-live="polite" className="hb-fade-in flex w-full flex-1 flex-col gap-4 px-1 py-3">
    <span className="sr-only">Loading this page…{navigationAvailable ? ' You can still use navigation.' : ''}</span>
    <SkeletonBlock className="h-7 w-48" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20" />)}
    </div>
    <div className="space-y-2 rounded-xl border border-surface-border bg-white p-3">
      {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-12" />)}
    </div>
  </div>
)

export { LoadingSpinner, LoadingOverlay, LoadingButton, LoadingCard, PageLoading, SkeletonBlock }
