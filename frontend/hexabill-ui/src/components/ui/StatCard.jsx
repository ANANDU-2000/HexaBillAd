import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * KPI tile: label, one figure, optional change.
 * Neutral card; the icon is a quiet neutral chip. Colour appears only on the
 * change line, and only with an arrow and a sign so it never relies on colour.
 *
 * `changeType` is the *meaning* ('positive' = good for the business), not the sign:
 * a fall in overdue receivables is positive.
 */
const StatCard = ({
  title,
  value,
  change,
  changeType = 'neutral',
  changeLabel = 'vs last period',
  icon: Icon,
  format = 'currency',
  currency = 'AED',
  formatter,
  loading = false,
  onClick,
}) => {
  // Amounts are never truncated: the currency code is a small prefix and the figure may wrap.
  const formatValue = (val) => {
    if (formatter) return formatter(val)
    if (format === 'currency') {
      const n = Number(val) || 0
      return (
        <>
          <span className="me-1 text-xs font-medium text-neutral-500">{currency}</span>
          {n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </>
      )
    }
    if (format === 'number') return (Number(val) || 0).toLocaleString('en-US')
    return val
  }

  const changeTone =
    changeType === 'positive' ? 'text-success-fg' : changeType === 'negative' ? 'text-error-fg' : 'text-neutral-500'
  const Trend = Number(change) > 0 ? TrendingUp : Number(change) < 0 ? TrendingDown : null
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`min-w-0 rounded-lg border border-surface-border bg-white p-4 text-start ${onClick ? 'transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-medium text-neutral-500">{title}</p>
        {Icon && (
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 sm:flex" aria-hidden>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton mt-2 h-7 w-3/4" aria-hidden />
      ) : (
        <p className="mt-1 text-lg font-semibold leading-tight tabular-nums text-text-primary [overflow-wrap:anywhere] sm:text-xl lg:text-2xl">{formatValue(value)}</p>
      )}
      {change !== undefined && change !== null && !loading && (
        <p className={`mt-1 flex flex-wrap items-center gap-x-1 text-xs font-medium ${changeTone}`}>
          {Trend && <Trend className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="tabular-nums">
            {Number(change) > 0 ? '+' : ''}
            {change}%
          </span>
          {changeLabel && <span className="font-normal text-neutral-500">{changeLabel}</span>}
        </p>
      )}
    </Tag>
  )
}

export default StatCard
