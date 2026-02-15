/**
 * Check if error is a network/connection error that should be suppressed
 * (because interceptor already handles it)
 */
export const isNetworkErrorToSuppress = (error) => {
  if (!error) return false
  
  // Suppress if it's a network error (interceptor will show it)
  return (
    !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_CORS' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.isConnectionBlocked
    )
  )
}

/**
 * Safe error handler - only shows toast if not a network error
 */
export const handleApiError = (error, defaultMessage = 'An error occurred', showToast = true) => {
  if (!error) return defaultMessage
  
  const message = error?.response?.data?.message || error?.message || defaultMessage
  
  // Suppress network errors (already handled by interceptor)
  if (showToast && !isNetworkErrorToSuppress(error)) {
    // Import toast dynamically to avoid circular dependencies
    import('react-hot-toast').then(({ default: toast }) => {
      toast.error(message)
    })
  }
  
  return message
}

