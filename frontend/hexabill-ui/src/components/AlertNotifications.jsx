import React, { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, Info, AlertCircle, CheckCircle2, ExternalLink, CheckCheck, Trash2 } from 'lucide-react'
import { alertsAPI } from '../services'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

// Request browser notification permission and show notification when alerts exist
const useBrowserNotifications = (unreadCount) => {
  const prevCountRef = useRef(0)
  const permissionRef = useRef(null)

  useEffect(() => {
    if (unreadCount <= 0 || typeof window === 'undefined' || !window.Notification) return
    if (permissionRef.current === 'denied') return
    if (unreadCount <= prevCountRef.current) {
      prevCountRef.current = unreadCount
      return
    }
    prevCountRef.current = unreadCount

    const show = () => {
      try {
        if (Notification.permission === 'granted') {
          new Notification(`${document.title || 'Alerts'} — alerts`, {
            body: unreadCount === 1 ? 'You have 1 unread notification.' : `You have ${unreadCount} unread notifications.`,
            icon: '/favicon.ico'
          })
        }
      } catch (e) {
        console.warn('Browser notification failed:', e)
      }
    }

    if (Notification.permission === 'granted') {
      show()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p
        if (p === 'granted') show()
      })
    }
  }, [unreadCount])
}

// Simple time ago formatter (no external dependency)
const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + ' years ago'
  
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + ' months ago'
  
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + ' days ago'
  
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + ' hours ago'
  
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + ' minutes ago'
  
  return Math.floor(seconds) + ' seconds ago'
}

const AlertNotifications = () => {
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Fetch unread count (handle both { success, data: number } and raw number)
  const fetchUnreadCount = async () => {
    try {
      const response = await alertsAPI.getUnreadCount()
      if (response?.success !== false && response != null) {
        const count = typeof response?.data === 'number' ? response.data : (response?.data?.data ?? response?.data ?? response ?? 0)
        setUnreadCount(Math.max(0, Number(count) || 0))
      }
    } catch (error) {
      if (!error?.isConnectionBlocked) console.error('Failed to fetch unread count:', error)
    }
  }

  // Fetch all alerts
  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const response = await alertsAPI.getAlerts({ unreadOnly: false, limit: 50 })
      if (response?.success) {
        setAlerts(response.data || [])
      }
    } catch (error) {
      if (!error?.isConnectionBlocked) console.error('Failed to fetch alerts:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  // Poll for new alerts every 60 seconds — only when tab is visible (reduced from 30s to reduce API requests)
  useEffect(() => {
    fetchUnreadCount()
    const poll = () => {
      if (document.visibilityState === 'visible') fetchUnreadCount()
    }
    const interval = setInterval(poll, 60000) // Increased from 30s to 60s to reduce API requests
    return () => clearInterval(interval)
  }, [])

  // Browser notifications when unread count increases (outside app)
  useBrowserNotifications(unreadCount)

  // Fetch alerts when panel opens
  useEffect(() => {
    if (showPanel) {
      fetchAlerts()
    }
  }, [showPanel])

  const handleMarkAllAsRead = async () => {
    try {
      const response = await alertsAPI.markAllAsRead()
      if (response?.success) {
        setAlerts(alerts.map(a => ({ ...a, isRead: true })))
        setUnreadCount(0)
        toast.success(`Marked ${response.data || 0} alerts as read`)
        await fetchUnreadCount()
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to mark all as read')
    }
  }

  const handleDismissAll = async () => {
    try {
      await alertsAPI.markAllAsResolved()
      const clearRes = await alertsAPI.clearResolved()
      setAlerts([])
      setUnreadCount(0)
      await fetchAlerts()
      await fetchUnreadCount()
      const totalRemoved = (clearRes?.data || 0)
      toast.success(totalRemoved > 0 ? `Dismissed ${totalRemoved} notifications` : 'All notifications dismissed')
    } catch (error) {
      console.error('Failed to dismiss all:', error)
      toast.error('Failed to dismiss notifications')
    }
  }

  const handleMarkAsRead = async (alertId) => {
    try {
      await alertsAPI.markAsRead(alertId)
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a))
      setUnreadCount(prev => Math.max(0, prev - 1))
      await fetchUnreadCount()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleMarkAsResolved = async (alertId) => {
    try {
      await alertsAPI.markAsResolved(alertId)
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isResolved: true } : a))
      toast.success('Alert resolved')
    } catch (error) {
      console.error('Failed to resolve alert:', error)
      if (!error?._handledByInterceptor) toast.error('Failed to resolve alert')
    }
  }

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
      default:
        return <Info className="h-5 w-5 text-primary-500" />
    }
  }

  const getSeverityBadgeColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'error':
        return 'bg-red-100 text-error-fg border-error-border'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'info':
      default:
        return 'bg-primary-100 text-primary-800 border-primary-300'
    }
  }

  const getAlertAction = (alert) => {
    const type = alert.type
    if (type === 'LowStock') return { label: 'View Products', path: '/products' }
    if (type === 'ProductExpiring') return { label: 'View Products', path: '/products' }
    if (type === 'OverdueInvoice') return { label: 'View Reports', path: '/reports?tab=outstanding' }
    if (type === 'BalanceMismatch' || type === 'DBMismatch') return { label: 'Customer Ledger', path: '/ledger' }
    if (type === 'DuplicateInvoice') return { label: 'View Sales', path: '/reports?tab=sales' }
    return null
  }

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-neutral-100"
        title="Alerts & notifications — low stock, overdue invoices, balance issues"
        aria-label="View alerts and notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg border border-surface-border shadow-lg z-50 max-h-[min(600px,80vh)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {alerts.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 flex items-center space-x-1"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3 w-3" />
                      <span>Read All</span>
                    </button>
                    <button
                      onClick={handleDismissAll}
                      className="text-xs px-2 py-1 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 flex items-center space-x-1"
                      title="Dismiss all notifications"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Dismiss All</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Alerts List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {alerts.map((alert) => {
                    const action = getAlertAction(alert)
                    return (
                      <div
                        key={alert.id}
                        className={`p-4 hover:bg-neutral-50 transition ${
                          !alert.isRead ? 'bg-primary-50' : ''
                        } ${alert.isResolved ? 'opacity-50' : ''}`}
                        onClick={() => !alert.isRead && handleMarkAsRead(alert.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {getSeverityIcon(alert.severity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${getSeverityBadgeColor(alert.severity)}`}>
                                {alert.type}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {formatTimeAgo(alert.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-neutral-900 mb-1">
                              {alert.title}
                            </p>
                            {alert.message && (
                              <p className="text-xs text-neutral-600 mb-2">
                                {alert.message}
                              </p>
                            )}
                            <div className="flex items-center space-x-2">
                              {action && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(action.path)
                                    setShowPanel(false)
                                  }}
                                  className="text-xs text-primary-600 hover:text-primary-800 flex items-center space-x-1"
                                >
                                  <span>{action.label}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              )}
                              {!alert.isResolved && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMarkAsResolved(alert.id)
                                  }}
                                  className="text-xs text-success hover:text-green-800"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AlertNotifications
