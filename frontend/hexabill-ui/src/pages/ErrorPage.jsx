import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { LoadingButton } from '../components/Loading'

const ErrorPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  // Use location.state when navigated with error info; works with BrowserRouter (no data router)
  const error = location.state?.error || null
  const errorMessage = error?.statusText || error?.message || location.state?.message || 'An unexpected error occurred'
  const errorStatus = error?.status || location.state?.status || 500

  const getErrorTitle = () => {
    switch (errorStatus) {
      case 404:
        return 'Page Not Found'
      case 403:
        return 'Access Denied'
      case 500:
        return 'Server Error'
      default:
        return 'Something Went Wrong'
    }
  }

  const getErrorDescription = () => {
    switch (errorStatus) {
      case 404:
        return "The page you're looking for doesn't exist or has been moved."
      case 403:
        return "You don't have permission to access this resource. Contact your administrator if you believe this is an error."
      case 500:
        return 'Our servers encountered an error. Please try again later.'
      default:
        return 'We encountered an unexpected error. Our team has been notified.'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{getErrorTitle()}</h1>
          <p className="text-gray-600 mb-4">{getErrorDescription()}</p>
          {errorStatus !== 404 && (
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 font-mono break-all">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <LoadingButton
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </LoadingButton>
          <LoadingButton
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </LoadingButton>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a href="/help" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
