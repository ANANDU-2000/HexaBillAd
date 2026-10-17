import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import { dailyCloseAPI } from '../../services/index'
import { localDateString } from '../../utils/dateFormat'
import { describeDailyClose } from './dailyCloseStatus'

const toneClass = {
  success: 'border-[var(--border)] text-[var(--text-primary)]',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  neutral: 'border-[var(--border)] text-[var(--text-primary)]',
}

// Today's Daily Close status for owners/admins. Read-only: closing, variance review and reopening stay in Daily close.
export default function DailyCloseStatusCard ({ branchId = null }) {
  const navigate = useNavigate()
  const [view, setView] = useState(null)

  useEffect(() => {
    let cancelled = false
    dailyCloseAPI.getStatus(localDateString(new Date()), branchId)
      .then((res) => { if (!cancelled) setView(describeDailyClose(res?.success === false ? { error: true } : { current: res?.data?.current ?? res?.data?.Current ?? null })) })
      .catch(() => { if (!cancelled) setView(describeDailyClose({ error: true })) })
    return () => { cancelled = true }
  }, [branchId])

  if (!view) return <div className="h-[72px] animate-pulse rounded-lg bg-[var(--bg-elevated)]" aria-hidden />
  const Icon = view.key === 'closed' ? CheckCircle : view.key === 'unavailable' ? CalendarCheck : AlertTriangle
  return (
    <section aria-label="Daily close status" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${toneClass[view.tone]}`}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Daily close: {view.title}</p>
          <p className="text-xs opacity-80">{view.detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate('/daily-close')}
        className="inline-flex min-h-11 items-center rounded-md border border-current px-4 text-sm font-medium"
      >
        {view.key === 'closed' ? 'View' : 'Open Daily close'}
      </button>
    </section>
  )
}
