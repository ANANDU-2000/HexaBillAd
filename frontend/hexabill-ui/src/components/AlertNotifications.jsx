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
          new Notification('HexaBill Alerts', {
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

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await alertsAPI.getUnreadCount()
      if (response?.success) {
        setUnreadCount(response.data || 0)
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
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
      console.error('Failed to fetch alerts:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  // Poll for new alerts every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
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
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }

  const handleClearResolved = async () => {
    try {
      const response = await alertsAPI.clearResolved()
      if (response?.success) {
        setAlerts(alerts.filter(a => !a.isResolved))
        toast.success(`Cleared ${response.data || 0} resolved alerts`)
      }
    } catch (error) {
      console.error('Failed to clear resolved:', error)
      toast.error('Failed to clear resolved alerts')
    }
  }

  const handleMarkAsRead = async (alertId) => {
    try {
      await alertsAPI.markAsRead(alertId)
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a))
      setUnreadCount(prev => Math.max(0, prev - 1))
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
      toast.error('Failed to resolve alert')
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
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getSeverityBadgeColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'info':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300'
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
        className="relative p-2 hover:bg-blue-700 rounded-lg transition flex items-center justify-center"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
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
          <div className="absolute right-0 mt-2 w-96 max-w-sm bg-white rounded-lg shadow-lg z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {alerts.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center space-x-1"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3 w-3" />
                      <span>Read All</span>
                    </button>
                    <button
                      onClick={handleClearResolved}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
                      title="Clear resolved alerts"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Alerts List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert) => {
                    const action = getAlertAction(alert)
                    return (
                      <div
                        key={alert.id}
                        className={`p-4 hover:bg-gray-50 transition ${
                          !alert.isRead ? 'bg-blue-50' : ''
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
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(alert.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {alert.title}
                            </p>
                            {alert.message && (
                              <p className="text-xs text-gray-600 mb-2">
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
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
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
                                  className="text-xs text-green-600 hover:text-green-800"
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
