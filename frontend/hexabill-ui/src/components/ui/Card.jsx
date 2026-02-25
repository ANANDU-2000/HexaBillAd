/**
 * Design system Card - UI_UX_DESIGN_LOCK: no shadow on default/elevated; border only.
 * Shadow only for modals (use shadow-lg in Modal component).
 */
export function Card({ variant = 'default', className = '', children, ...props }) {
  const variants = {
    default:
      'bg-white rounded-xl border border-neutral-200 p-4 md:p-6 transition-shadow duration-150',
    elevated:
      'bg-white rounded-xl border border-neutral-200 p-4 md:p-6 transition-shadow duration-150',
    glass: 'bg-white/80 backdrop-blur-md rounded-xl border border-neutral-200 p-4 md:p-6',
  }
  return (
    <div className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  )
}

export default Card
