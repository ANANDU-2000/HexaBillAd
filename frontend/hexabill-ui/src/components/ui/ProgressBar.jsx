/**
 * Determinate progress (uploads, imports, backups). For work of unknown length
 * use a skeleton or the Button `loading` state instead.
 */
const BARS = { primary: 'bg-primary-600', success: 'bg-success', warning: 'bg-warning', error: 'bg-error' }

export default function ProgressBar({ value = 0, max = 100, label, showValue = true, tone = 'primary', className = '' }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-neutral-600">
          {label && <span className="truncate">{label}</span>}
          {showValue && <span className="tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label || 'Progress'}
      >
        <div className={`h-full rounded-full ${BARS[tone] || BARS.primary} transition-[width] duration-panel ease-standard`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
