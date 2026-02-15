import axios from 'axios'
import toast from 'react-hot-toast'
import { connectionManager } from './connectionManager'

// API base URL: prefer build-time env (Vercel) then production hostname, else localhost
const envApi = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
const API_BASE_URL = envApi && envApi.startsWith('http')
  ? (envApi.endsWith('/api') ? envApi : envApi + '/api')
  : (isProduction ? 'https://hexabill.onrender.com/api' : 'http://localhost:5000/api')

// Error throttling to prevent flooding
let lastErrorToast = null
let errorToastCount = 0
let lastNetworkErrorToast = null
const ERROR_THROTTLE_MS = 3000 // Show max 1 error toast per 3 seconds for general errors
const SERVER_ERROR_THROTTLE_MS = 12000 // Show max 1 server (500) toast per 12 seconds to avoid spam
const NETWORK_ERROR_THROTTLE_MS = 15000 // Show max 1 network error toast per 15 seconds
let lastServerErrorToast = null

// Request deduplication and throttling to prevent 429 errors
const pendingRequests = new Map()
const requestThrottle = new Map() // Track last request time per endpoint
const REQUEST_THROTTLE_MS = 50 // Only throttle very rapid duplicates (< 50ms) - prevents double-clicks
const MAX_CONCURRENT_REQUESTS = 20 // Increased concurrent requests limit

// Generate request key for deduplication
const getRequestKey = (config) => {
  if (!config) {
    return `UNKNOWN_${Date.now()}_${Math.random()}`
  }
  const method = (config.method || 'GET').toUpperCase()
  const url = config.url || ''
  const params = config.params || {}
  return `${method}_${url}_${JSON.stringify(params)}`
}

const showThrottledError = (message, isNetworkError = false) => {
  const now = Date.now()
  const throttleTime = isNetworkError ? NETWORK_ERROR_THROTTLE_MS : ERROR_THROTTLE_MS
  const lastToast = isNetworkError ? lastNetworkErrorToast : lastErrorToast

  if (lastToast && (now - lastToast) < throttleTime) {
    errorToastCount++
    return // Skip this error, already showing one
  }

  if (isNetworkError) {
    lastNetworkErrorToast = now
  } else {
    lastErrorToast = now
  }

  errorToastCount = 1

  // For network errors, show longer duration and less intrusive style
  if (isNetworkError) {
    toast.error(message, {
      duration: 6000,
      id: 'network-error', // Use same ID to replace previous toast
      position: 'top-center'
    })
  } else {
    toast.error(message, { duration: 4000 })
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token, check connection, and throttle requests
api.interceptors.request.use(
  (config) => {
    // CRITICAL: Ensure config exists and has required properties
    if (!config) {
      config = {}
    }
    if (!config.method) {
      config.method = 'GET'
    }
    if (!config.url) {
      config.url = ''
    }

    // Check if we should allow this request
    if (!connectionManager.shouldAllowRequest()) {
      const error = new Error('Server connection unavailable. Please wait...')
      error.config = config
      error.isConnectionBlocked = true
      return Promise.reject(error)
    }

    // CRITICAL: Throttle requests to prevent 429 errors
    const requestKey = getRequestKey(config)
    const now = Date.now()
    const lastRequestTime = requestThrottle.get(requestKey) || 0
    const timeSinceLastRequest = now - lastRequestTime

    // CRITICAL: Remove aggressive throttling - only track, don't block
    // Only log very rapid duplicates for debugging, but allow all requests to proceed
    if (timeSinceLastRequest < REQUEST_THROTTLE_MS && !config._isRetry) {
      // Log duplicate but don't block - allows normal page loads
      if (pendingRequests.has(requestKey)) {
        console.log(`⏸️ Rapid duplicate request detected (${timeSinceLastRequest}ms): ${config.method} ${config.url} - allowing to proceed`)
      }
    }

    // CRITICAL: Don't block requests - only track for monitoring
    // Remove all blocking logic - let server handle rate limiting
    // The server's 429 response will be handled gracefully

    // Track this request (for monitoring only, not blocking)
    config._requestKey = requestKey
    config._requestTime = now

    // Update throttle time (for tracking only)
    requestThrottle.set(requestKey, now)

    // Clean up old throttle entries periodically (prevent memory leaks)
    if (requestThrottle.size > 200) {
      const oneMinuteAgo = now - 60000
      for (const [key, time] of requestThrottle.entries()) {
        if (time < oneMinuteAgo) {
          requestThrottle.delete(key)
        }
      }
    }

    // Add auth token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    // MULTI-TENANT IMPERSONATION: Add impersonation header for Super Admin
    const selectedTenantId = localStorage.getItem('selected_tenant_id')
    if (selectedTenantId) {
      config.headers = config.headers || {}
      config.headers['X-Tenant-Id'] = selectedTenantId
    }

    // Add retry configuration
    config._retryCount = config._retryCount || 0
    config._maxRetries = 3
    config._requestKey = requestKey // Store for cleanup in response interceptor

    // CRITICAL: Request interceptor must return config, not promise
    // Deduplication will be handled by tracking the request key
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors and cleanup
// Offline detection and error handling
api.interceptors.response.use(
  (response) => {
    // Mark connection as successful on any successful response
    connectionManager.markConnected()

    // Clean up pending request tracking
    if (response.config?._requestKey) {
      pendingRequests.delete(response.config._requestKey)
    }

    return response
  },
  async (error) => {
    // Handle connection blocked errors
    if (error.isConnectionBlocked) {
      return Promise.reject(error)
    }

    // Handle network/connection errors
    const isNetworkError = !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_CORS' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError')
    )

    if (isNetworkError) {
      // Mark connection as failed
      connectionManager.markDisconnected()

      // Show throttled error message
      const errorMsg = error.code === 'ERR_CORS'
        ? 'Backend server may have stopped. Please restart the backend.'
        : `Cannot connect to server. Please ensure the backend is running at ${API_BASE_URL.replace('/api', '')}`

      showThrottledError(errorMsg, true)

      // Only log once per error type
      if (errorToastCount === 1) {
        console.error('Network Error Details:', {
          url: error.config?.url,
          baseURL: API_BASE_URL,
          method: error.config?.method,
          message: error.message,
          code: error.code
        })
      }

      return Promise.reject(error)
    }

    // Clean up pending request tracking on error (do this first)
    if (error.config?._requestKey) {
      pendingRequests.delete(error.config._requestKey)
    }

    // Handle 429 Too Many Requests - CRITICAL: Prevent request flooding
    if (error.response?.status === 429) {
      connectionManager.markConnected() // Server is responding

      const retryAfter = error.response?.headers?.['retry-after'] || 5
      const message = `Too many requests. Please wait ${retryAfter} seconds before trying again.`

      showThrottledError(message, false)

      // Don't log every 429 error to prevent console flooding
      if (errorToastCount === 1) {
        console.warn('⚠️ Rate limit exceeded (429). Requests are being throttled.')
      }

      return Promise.reject(error)
    }

    // Handle throttled requests (from interceptor) - silently reject
    if (error.isThrottled) {
      // Don't show error for throttled requests - they're expected behavior
      return Promise.reject(error)
    }

    // Handle rate limited requests
    if (error.isRateLimited) {
      showThrottledError('Too many requests in progress. Please wait...', false)
      return Promise.reject(error)
    }

    // Handle 404 for Branches/Routes API (backend may need rebuild + migrations)
    const url = (error.config?.url || '').toLowerCase()
    if (error.response?.status === 404 && (url.includes('/branches') || url.includes('/routes'))) {
      connectionManager.markConnected()
      if (!sessionStorage.getItem('hexabill_branches_routes_404_shown')) {
        sessionStorage.setItem('hexabill_branches_routes_404_shown', '1')
        showThrottledError(
          'Branches & Routes API not found. Stop the API, then run backend/HexaBill.Api/run-api.ps1 (or: dotnet build && dotnet ef database update && dotnet run in that folder), then restart.',
          false
        )
      }
      return Promise.reject(error)
    }

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      connectionManager.markConnected() // Server is responding, just auth issue

      const hadToken = !!(error.config?.headers?.Authorization || localStorage.getItem('token'))
      const authFailure = error.response?.headers?.['x-auth-failure']
      const errorMessage = error.response?.data?.message || ''
      const tokenExpired = error.response?.headers?.['token-expired'] === 'true'

      // Only logout + redirect when we HAD a token (user was logged in, now session invalid).
      // If we had no token, this is a public/unauthenticated request (e.g. login page) - don't redirect.
      const isAuthFailure = hadToken && (
        authFailure ||
        tokenExpired ||
        errorMessage.toLowerCase().includes('session') ||
        errorMessage.toLowerCase().includes('expired') ||
        errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage.toLowerCase().includes('login')
      )

      if (isAuthFailure) {
        // Clear auth data
        localStorage.removeItem('token')
        localStorage.removeItem('user')

        // Show appropriate error message (only once)
        const message = errorMessage ||
          (tokenExpired ? 'Your session has expired. Please login again.' :
            'Authentication required. Please login again.')

        toast.error(message, { duration: 3000 })

        // Small delay to let the toast show before redirect
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
      } else if (hadToken) {
        // Had token but 401 without clear auth-failure - could be permission or expired
        showThrottledError(errorMessage || 'You are not authorized to perform this action')
      }
      // If no token: silent fail (e.g. BrandingProvider on login page) - no toast, no redirect
    } else if (error.response?.status >= 500) {
      // Server errors - throttle heavily to avoid repeated toasts for branches/routes/reports
      connectionManager.markConnected()
      const now = Date.now()
      if (lastServerErrorToast && (now - lastServerErrorToast) < SERVER_ERROR_THROTTLE_MS) {
        return Promise.reject(error)
      }
      lastServerErrorToast = now
      const correlationId = error.response?.data?.correlationId || error.response?.headers?.['x-correlation-id']
      const baseMessage = error.response?.data?.message || 'Server is having trouble. Check that the backend is running and try again.'
      const errorMsg = correlationId ? `${baseMessage} (Ref: ${correlationId})` : baseMessage
      showThrottledError(errorMsg)
    } else if (error.response?.data?.message) {
      // Server is responding with message
      connectionManager.markConnected()
      const correlationId = error.response?.data?.correlationId || error.response?.headers?.['x-correlation-id']
      const baseMessage = error.response.data.message
      const errorMsg = correlationId ? `Something went wrong. Ref: ${correlationId}` : baseMessage
      showThrottledError(errorMsg)
    } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      // Server is responding with errors array
      connectionManager.markConnected()
      const correlationId = error.response?.data?.correlationId || error.response?.headers?.['x-correlation-id']
      const errorMsg = error.response.data.errors.join(', ')
      const finalMsg = correlationId ? `Something went wrong. Ref: ${correlationId}` : errorMsg
      showThrottledError(finalMsg)
    } else if (error.response?.data) {
      // Server is responding but structure is different
      connectionManager.markConnected()
      const correlationId = error.response?.data?.correlationId || error.response?.headers?.['x-correlation-id']
      const errorMsg = correlationId ? `Something went wrong. Ref: ${correlationId}` : 'An error occurred. Please try again.'
      showThrottledError(errorMsg)
    } else {
      // Unknown error
      connectionManager.markConnected()
      showThrottledError('An error occurred. Please try again.')
    }

    return Promise.reject(error)
  }
)

export default api
