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

  // Mark connection as failed
  markDisconnected() {
    if (this.isConnected) {
      this.isConnected = false
      this.failedRequests++
      this.notifyStatusChange(false)
      
      // Start checking for reconnection
      this.startConnectionCheck()
    } else {
      this.failedRequests++
    }
  }

  // Mark connection as successful
  markConnected() {
    if (!this.isConnected || this.failedRequests > 0) {
      this.isConnected = true
      this.failedRequests = 0
      this.lastConnectionCheck = Date.now()
      this.notifyStatusChange(true)
      this.stopConnectionCheck()
      
      // Retry queued requests
      this.retryQueuedRequests()
    }
  }

  // Check if server is available
  async checkConnection() {
    try {
      // Server root for health (backend serves /health at root, not under /api)
      const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '')
      const baseURL = apiBase.endsWith('/api') ? apiBase.replace(/\/api$/, '') : apiBase
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      // Try health endpoint first, fallback to diagnostics/status
      const endpoints = ['/health', '/status']
      let connected = false
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${baseURL}${endpoint}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          // If we get any response (even 401/500), server is up
          if (response && response.status !== 0) {
            connected = true
            break
          }
        } catch (e) {
          // Try next endpoint
          continue
        }
      }
      
      clearTimeout(timeoutId)
      
      if (connected) {
        this.markConnected()
        return true
      } else {
        this.markDisconnected()
        return false
      }
    } catch (error) {
      this.markDisconnected()
      return false
    }
  }

  // Start periodic connection checking
  startConnectionCheck() {
    if (this.connectionCheckInterval) {
      return
    }
    
    // Check immediately
    this.checkConnection()
    
    // Then check every 10 seconds
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection()
    }, 10000)
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
    this.stopConnectionCheck()
    this.retryQueue = []
    this.notifyStatusChange(true)
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager()

