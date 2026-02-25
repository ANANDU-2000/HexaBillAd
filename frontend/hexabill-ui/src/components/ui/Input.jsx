import { forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * Design system Input: border-neutral-300, focus:ring-primary-500.
 * Use for consistent forms across the app.
 */
const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  required = false,
  labelClassName = '',
  ...props
}, ref) => {
  const inputId = props.id || props.name ? `input-${props.name || props.id}` : undefined
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium text-neutral-700 mb-1.5 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`block w-full px-3 py-2.5 bg-white border rounded-md text-sm text-neutral-900 placeholder:text-neutral-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-neutral-50 disabled:text-neutral-500
            ${error
              ? 'border-error focus:ring-error focus:border-error'
              : 'border-neutral-300'
            } ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none" aria-hidden>
            <AlertCircle className="h-4 w-4 text-error" />
          </div>
        )}
      </div>
      {error && (
        <p id={inputId && `${inputId}-error`} className="text-xs text-error flex items-center gap-1">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={inputId && `${inputId}-helper`} className="text-xs text-neutral-500">{helperText}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
