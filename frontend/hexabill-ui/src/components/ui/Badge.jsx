/**
 * Status badge. Colour always comes with text; `dot` adds a leading marker for
 * dense tables. Variants map to the status token trio (fg / bg / border).
 */
const VARIANTS = {
  success: 'bg-success-bg text-success-fg border-success-border',
  warning: 'bg-warning-bg text-warning-fg border-warning-border',
  error: 'bg-error-bg text-error-fg border-error-border',
  info: 'bg-info-bg text-info-fg border-info-border',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
}
const DOTS = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-neutral-400',
}

const Badge = ({ variant = 'neutral', dot = false, size = 'md', children, className = '' }) => {
  const key = variant === 'default' ? 'neutral' : variant
  const sizeCls = size === 'sm' ? 'px-1.5 text-micro' : 'px-2 py-0.5 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${sizeCls} ${VARIANTS[key] || VARIANTS.neutral} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[key] || DOTS.neutral}`} aria-hidden />}
      {children}
    </span>
  )
}
export default Badge
