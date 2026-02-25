import React, { useState, useEffect } from 'react'
import { connectionManager } from '../services/connectionManager'
import { Wifi, WifiOff, X } from 'lucide-react'

function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubscribe = connectionManager.onStatusChange((connected) => {
      setIsConnected(connected)
      setIsVisible(!connected)
      if (connected) setDismissed(false)
      if (connected) {
        setTimeout(() => setIsVisible(false), 5000)
      }
    })
    setIsConnected(connectionManager.isConnected)
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  if (!isVisible || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border transition-all duration-300 ease-out ${
        isConnected
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-white border-red-200 text-red-800 shadow-red-100'
      }`}
    >
      {isConnected ? (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
            <Wifi className="h-5 w-5 text-emerald-600" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold">Connection restored</p>
            <p className="text-xs text-emerald-600/80">You're back online</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
            <WifiOff className="h-5 w-5 text-red-600" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold">Service temporarily unavailable</p>
            <p className="text-xs text-red-600/90">Service may be temporarily unavailable. Please try again or contact support.</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-1 p-2 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

export default ConnectionStatus
