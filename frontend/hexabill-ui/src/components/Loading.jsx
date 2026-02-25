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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        <LoadingSpinner size="xl" className="text-blue-600" />
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  )
}

const LoadingButton = ({ loading, children, className = '', ...props }) => {
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${className}`}
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-center space-x-3">
        <LoadingSpinner className="text-blue-600" />
        <span className="text-gray-600 font-medium">{message}</span>
      </div>
    </div>
  )
}

export { LoadingSpinner, LoadingOverlay, LoadingButton, LoadingCard }
