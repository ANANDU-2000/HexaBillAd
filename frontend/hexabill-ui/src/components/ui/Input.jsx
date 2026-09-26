import { forwardRef } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const Input = forwardRef(({
  label,
  error,
  success,
  helperText,
  className = '',
  required = false,
  labelClassName = '',
  icon = null,
  size = 'md',
  ...props
}, ref) => {
  const inputId = props.id || (props.name ? `input-${props.name}` : undefined)
  const height = size === 'sm' ? 'min-h-[32px]' : 'min-h-[36px]'
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-xs font-medium text-neutral-700 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400" aria-hidden>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`block w-full ${icon ? 'pl-9' : 'px-3'} pr-8 ${height} bg-white border rounded-md text-sm text-neutral-900 placeholder:text-neutral-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-neutral-50 disabled:text-neutral-500 read-only:bg-neutral-50
            ${error ? 'border-error focus:ring-error focus:border-error' : success ? 'border-success' : 'border-neutral-300'} ${className}`}
          {...props}
        />
        {error && (
          <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none" aria-hidden>
            <AlertCircle className="h-4 w-4 text-error" />
          </span>
        )}
        {success && !error && (
          <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none" aria-hidden>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </span>
        )}
      </div>
      {error && (
        <p id={inputId && `${inputId}-error`} className="text-xs text-error">{error}</p>
      )}
      {helperText && !error && (
        <p id={inputId && `${inputId}-helper`} className="text-xs text-neutral-500">{helperText}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
