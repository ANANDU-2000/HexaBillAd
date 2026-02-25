import React from 'react'
import { RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    // Reset error state instead of full page reload
    this.setState({ hasError: false, error: null, errorInfo: null })
    // Optionally navigate to dashboard or refresh data
    if (window.location.pathname !== '/dashboard') {
      window.location.href = '/dashboard'
    } else {
      // If already on dashboard, trigger a data refresh event
      window.dispatchEvent(new Event('dataUpdated'))
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-sm w-full text-center">
            <p className="text-sm font-medium text-neutral-900 mb-2">Something went wrong</p>
            <p className="text-xs text-neutral-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 mx-auto px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-700"
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

