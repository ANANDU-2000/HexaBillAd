/**
 * Card: white surface, hairline border, no shadow. Shadows are for overlays only.
 * `table` removes padding so a table or list can run edge to edge.
 */
const VARIANTS = {
  default: 'bg-white rounded-lg border border-surface-border p-4 md:p-5',
  metric: 'bg-white rounded-lg border border-surface-border p-4',
  form: 'bg-white rounded-lg border border-surface-border p-4 md:p-6',
  table: 'bg-white rounded-lg border border-surface-border p-0 overflow-hidden',
  empty: 'bg-white rounded-lg border border-dashed border-neutral-300 p-6 text-center',
}
// Legacy variant names, kept so older callers still render a plain card.
VARIANTS.elevated = VARIANTS.default
VARIANTS.glass = VARIANTS.default

export function Card({ variant = 'default', as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`${VARIANTS[variant] || VARIANTS.default} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

/** Card header row: title on the start side, optional actions on the end side. */
export function CardHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export default Card
