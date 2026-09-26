/**
 * Design system Card - UI_UX_DESIGN_LOCK: no shadow on default/elevated; border only.
 * Shadow only for modals (use shadow-lg in Modal component).
 */
export function Card({ variant = 'default', className = '', children, ...props }) {
  const variants = {
    default: 'bg-white rounded-lg border border-neutral-200 p-3 md:p-4',
    elevated: 'bg-white rounded-lg border border-neutral-200 p-3 md:p-4',
    metric: 'bg-white rounded-lg border border-neutral-200 p-3',
    form: 'bg-white rounded-lg border border-neutral-200 p-4',
    table: 'bg-white rounded-lg border border-neutral-200 p-0 overflow-hidden',
    empty: 'bg-white rounded-lg border border-dashed border-neutral-300 p-6 text-center',
    glass: 'bg-white/80 backdrop-blur-md rounded-lg border border-neutral-200 p-3 md:p-4',
  }
  return (
    <div className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  )
}

export default Card
