import { Loader2 } from 'lucide-react'

const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed'

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-primary-500',
  secondary: 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus:ring-neutral-400',
  outline: 'bg-transparent text-primary-700 border border-primary-600 hover:bg-primary-50 active:bg-primary-100 focus:ring-primary-500',
  ghost: 'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-400',
  danger: 'bg-error text-white hover:bg-red-700 active:bg-red-800 focus:ring-error',
  success: 'bg-success text-white hover:bg-emerald-700 active:bg-emerald-800 focus:ring-success',
  icon: 'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-400',
}

const sizes = {
  sm: 'px-2.5 text-sm min-h-[32px]',
  md: 'px-3 text-sm min-h-[36px]',
  lg: 'px-4 text-sm min-h-[44px]',
  icon: 'p-0 min-h-[32px] min-w-[32px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  loading = false,
  children,
  ...props
}) {
  const resolvedSize = variant === 'icon' && size === 'md' ? 'icon' : size
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[resolvedSize] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
