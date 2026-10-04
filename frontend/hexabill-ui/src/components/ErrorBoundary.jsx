import React from 'react'
import { RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  handleReset = () => {
    // Full reload so the browser fetches the latest JS/CSS (fixes stale SPA chunks after deploy).
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const chunkFailure = /ChunkLoadError|Loading chunk .* failed|dynamically imported module|Importing a module script failed/i.test(this.state.error?.message || '')
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      return (
        <div className={`${this.props.contained ? 'min-h-[240px] flex-1' : 'min-h-screen'} bg-[#F8FAFC] flex items-center justify-center p-4`}>
          <div role="alert" className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full text-center">
            <p className="text-base font-semibold text-slate-900 mb-2">{offline ? 'You’re offline' : chunkFailure ? 'This page could not load' : 'This page encountered a problem'}</p>
            <p className="text-sm text-slate-600 mb-4">{offline
              ? `Reconnect, then reload this page.${this.props.contained ? ' Navigation is still available.' : ''}`
              : chunkFailure
                ? 'The connection was interrupted or the application was updated. Reload to try again.'
                : this.props.contained ? 'Reload to try again, or use navigation to open another page.' : 'Reload to try again. If the problem continues, contact support.'}</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex min-h-11 items-center gap-2 mx-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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

