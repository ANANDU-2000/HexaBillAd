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
  
  const message = error?.response?.data?.message || defaultMessage
  
  // Suppress network errors (already handled by interceptor)
  if (showToast && !isNetworkErrorToSuppress(error)) {
    // Import toast dynamically to avoid circular dependencies
    import('react-hot-toast').then(({ default: toast }) => {
      toast.error(message)
    })
  }
  
  return message
}


/**
 * Plain-language reason from a failed API call. Reads the app's own message, an errors list,
 * ASP.NET validation errors ({ errors: { Field: ['text'] } }) and ProblemDetails titles.
 */
export const readApiErrorReason = (error, fallback = '') => {
  const data = error?.response?.data
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
    if (Array.isArray(data.errors)) {
      const joined = data.errors.filter((e) => typeof e === 'string' && e.trim()).join(', ')
      if (joined) return joined
    }
    if (data.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors).flat().find((e) => typeof e === 'string' && e.trim())
      if (first) return first
    }
    if (typeof data.title === 'string' && data.title.trim()) return data.title.trim()
  }
  return fallback
}

/** True when the server may have saved the record even though the client saw a failure. */
export const saveOutcomeIsUncertain = (error) => {
  const status = error?.response?.status
  return !status || status >= 500
}
