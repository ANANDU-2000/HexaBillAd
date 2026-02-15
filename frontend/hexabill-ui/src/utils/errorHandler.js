/**
 * Global Error Handler Utility
 * Prevents errors from breaking the app and provides consistent error handling
 */

export const handleAsyncError = async (asyncFn, errorMessage = 'An error occurred') => {
  try {
    return await asyncFn()
  } catch (error) {
    console.error(errorMessage, error)
    // Don't throw - let caller handle
    return { error, success: false }
  }
}

export const safeSetState = (setState, value, isMounted = true) => {
  if (isMounted) {
    try {
      setState(value)
    } catch (error) {
      console.error('State update error:', error)
    }
  }
}

export const validateNumber = (value, min = 0, max = 1000000) => {
  const num = parseFloat(value)
  if (isNaN(num)) return { valid: false, error: 'Must be a number' }
  if (num < min) return { valid: false, error: `Must be at least ${min}` }
  if (num > max) return { valid: false, error: `Must be at most ${max}` }
  return { valid: true, value: num }
}

export const validateRequired = (value, fieldName = 'Field') => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return { valid: false, error: `${fieldName} is required` }
  }
  return { valid: true }
}

export const preventMultipleClicks = (isLoading, setIsLoading, action, delay = 1000) => {
  if (isLoading) {
    return false
  }
  setIsLoading(true)
  setTimeout(() => setIsLoading(false), delay)
  return true
}

export const safeAsyncOperation = async (operation, onSuccess, onError) => {
  try {
    const result = await operation()
    if (result?.success !== false) {
      onSuccess?.(result)
      return result
    } else {
      onError?.(result.error || new Error('Operation failed'))
      return result
    }
  } catch (error) {
    onError?.(error)
    return { error, success: false }
  }
}
