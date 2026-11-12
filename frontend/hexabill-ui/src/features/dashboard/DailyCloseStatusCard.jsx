import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import { dailyCloseAPI } from '../../services/index'
import { localDateString } from '../../utils/dateFormat'
import { describeDailyClose } from './dailyCloseStatus'

const toneClass = {
  success: 'border-[var(--border)] text-[var(--text-primary)]',
  warning: 'border-warning-border bg-warning-bg text-warning-fg',
  neutral: 'border-[var(--border)] text-[var(--text-primary)]',
}

// Today's Daily Close status for owners/admins. Read-only: closing, variance review and reopening stay in Daily close.
export default function DailyCloseStatusCard ({ branchId = null, compact = false }) {
  const navigate = useNavigate()
  const [view, setView] = useState(null)

  useEffect(() => {
    let cancelled = false
    dailyCloseAPI.getStatus(localDateString(new Date()), branchId)
      .then((res) => { if (!cancelled) setView(describeDailyClose(res?.success === false ? { error: true } : { current: res?.data?.current ?? res?.data?.Current ?? null })) })
      .catch(() => { if (!cancelled) setView(describeDailyClose({ error: true })) })
    return () => { cancelled = true }
  }, [branchId])

  if (!view) return <div className={compact ? "h-6 w-36 animate-pulse rounded bg-[var(--bg-elevated)]" : "h-[72px] animate-pulse rounded-lg bg-[var(--bg-elevated)]"} aria-hidden />
  const Icon = view.key === 'closed' ? CheckCircle : view.key === 'unavailable' ? CalendarCheck : AlertTriangle

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => navigate('/daily-close')}
        className={`inline-flex min-h-touch items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${view.tone === 'warning' ? 'bg-warning-bg text-warning-fg hover:bg-warning-border' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Daily close: {view.title}</span>
        <span className="hidden sm:inline font-normal opacity-75">· {view.detail}</span>
      </button>
    )
  }

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
        className="inline-flex min-h-touch items-center rounded-md border border-current px-4 text-sm font-medium"
      >
        {view.key === 'closed' ? 'View' : 'Open Daily close'}
      </button>
    </section>
  )
}
