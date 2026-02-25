import { useState, useEffect } from 'react'
import { Construction } from 'lucide-react'

const MAINTENANCE_EVENT = 'hexabill:maintenance'

export const showMaintenanceOverlay = (message = 'System under maintenance. Back shortly.') => {
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: { message } }))
}

export const MaintenanceOverlay = () => {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handler = (e) => {
      setMessage(e.detail?.message || 'System under maintenance. Back shortly.')
      setVisible(true)
    }
    window.addEventListener(MAINTENANCE_EVENT, handler)
    return () => window.removeEventListener(MAINTENANCE_EVENT, handler)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md mx-4 p-8 bg-white rounded-xl shadow-2xl text-center">
        <Construction className="h-16 w-16 mx-auto text-amber-500 mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-bold text-slate-900 mb-2">Under Maintenance</h1>
        <p className="text-slate-600 mb-6">{message}</p>
        <p className="text-sm text-slate-400">We&apos;ll be back shortly. Please try again in a few minutes.</p>
      </div>
    </div>
  )
}
