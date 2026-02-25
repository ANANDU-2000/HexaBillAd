// Connection Status Manager
// Tracks server connection status and prevents redundant API calls

class ConnectionManager {
  constructor() {
    this.isConnected = true
    this.lastConnectionCheck = null
    this.connectionCheckInterval = null
    this.failedRequests = 0
    this.maxFailedRequests = 3
    this.listeners = []
    this.retryQueue = []
    this.isRetrying = false
    this.consecutiveHealthFailures = 0
    this.HEALTH_CHECK_INTERVAL_MS = 15000
    this.HEALTH_CHECK_BACKOFF_MS = 60000
  }

  // Subscribe to connection status changes
  onStatusChange(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  // Notify all listeners of status change
  notifyStatusChange(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status)
      } catch (error) {
        console.error('Error in connection status callback:', error)
      }
    })
  }

  isLoginPage() {
    if (typeof window === 'undefined') return false
    const p = window.location.pathname
    return p === '/login' || p === '/Admin26'
  }

  // Mark connection as failed. After first failure, block all requests to avoid flood of ERR_CONNECTION_REFUSED.
  markDisconnected() {
    if (this.isConnected) {
      this.isConnected = false
      this.failedRequests = this.maxFailedRequests // Block immediately so other components don't all hit the server
      this.notifyStatusChange(false)
      if (!this.isLoginPage()) this.startConnectionCheck()
    } else {
      this.failedRequests = this.maxFailedRequests
    }
  }

  // Mark connection as successful
  markConnected() {
    const wasDisconnected = !this.isConnected || this.failedRequests > 0
    if (wasDisconnected) {
      this.isConnected = true
      this.failedRequests = 0
      this.consecutiveHealthFailures = 0
      this.lastConnectionCheck = Date.now()
      this.notifyStatusChange(true)
      this.stopConnectionCheck()
      // Fire connectionRestored event so pages can auto-refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('connectionRestored'))
      }
      // Retry queued requests
      this.retryQueuedRequests()
    }
  }

  // Check if server is available (same URL as api.js via apiConfig)
  async checkConnection() {
    if (this.isLoginPage()) return false
    try {
      const { getApiBaseUrl } = await import('./apiConfig')
      const apiBase = getApiBaseUrl()
      const baseURL = apiBase.endsWith('/api') ? apiBase.replace(/\/api$/, '') : apiBase
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      // Single health check to avoid multiple failed-request logs when backend is down
      let connected = false
      try {
        const response = await fetch(`${baseURL}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        })
        if (response && response.status !== 0) connected = true
      } catch (_) {
        // Backend down; avoid logging to reduce console noise
      }
      
      clearTimeout(timeoutId)
      
      if (connected) {
        this.consecutiveHealthFailures = 0
        this.markConnected()
        return true
      } else {
        this.consecutiveHealthFailures = (this.consecutiveHealthFailures || 0) + 1
        this.markDisconnected()
        return false
      }
    } catch (error) {
      this.consecutiveHealthFailures = (this.consecutiveHealthFailures || 0) + 1
      this.markDisconnected()
      return false
    }
  }

  getHealthCheckIntervalMs() {
    const failures = this.consecutiveHealthFailures || 0
    if (failures >= 6) return this.HEALTH_CHECK_BACKOFF_MS
    return this.HEALTH_CHECK_INTERVAL_MS
  }

  // Start periodic connection checking (never on login page). Backoff (15s → 60s after 6 failures) to reduce console spam.
  startConnectionCheck() {
    if (this.connectionCheckInterval || this.isLoginPage()) {
      return
    }
    const runCheck = () => {
      if (this.isLoginPage()) return
      this.checkConnection()
      const intervalMs = this.getHealthCheckIntervalMs()
      if (this.connectionCheckInterval) clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = setInterval(runCheck, intervalMs)
    }
    this.checkConnection()
    this.connectionCheckInterval = setInterval(runCheck, this.getHealthCheckIntervalMs())
  }

  // Stop connection checking
  stopConnectionCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
  }

  // Add request to retry queue
  addToRetryQueue(requestFn) {
    this.retryQueue.push({
      fn: requestFn,
      timestamp: Date.now()
    })
  }

  // Retry queued requests
  async retryQueuedRequests() {
    if (this.isRetrying || this.retryQueue.length === 0) {
      return
    }

    this.isRetrying = true
    const queue = [...this.retryQueue]
    this.retryQueue = []

    for (const item of queue) {
      // Only retry requests from last 5 minutes
      if (Date.now() - item.timestamp < 300000) {
        try {
          await item.fn()
        } catch (error) {
          // If retry fails, don't add back to queue
          console.error('Retry failed:', error)
        }
      }
    }

    this.isRetrying = false
  }

  // Should allow request?
  shouldAllowRequest() {
    // If we've had too many failures, block requests temporarily
    if (this.failedRequests >= this.maxFailedRequests) {
      return false
    }
    return true
  }

  // Reset connection state
  reset() {
    this.isConnected = true
    this.failedRequests = 0
    this.consecutiveHealthFailures = 0
    this.stopConnectionCheck()
    this.retryQueue = []
    this.notifyStatusChange(true)
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager()

