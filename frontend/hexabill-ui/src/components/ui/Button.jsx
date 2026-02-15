/**
 * Design system Button - primary, secondary, danger, ghost
 * Use for consistent actions across the app.
 */
const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-primary-500 shadow-sm hover:shadow-md',
  secondary: 'bg-white text-neutral-700 border border-neutral-300 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 focus:ring-neutral-500',
  danger: 'bg-error text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500 shadow-sm',
  ghost: 'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-500',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
