import { forwardRef, useId } from 'react'
import { AlertCircle } from 'lucide-react'

const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  required = false,
  icon,
  id,
  ...props
}, ref) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`
  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-primary-500 text-neutral-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full ${icon ? 'pl-10' : 'px-3'} min-h-[44px] md:min-h-[40px] py-2 bg-white border rounded-md placeholder:text-neutral-400 text-neutral-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed sm:text-sm ${error
            ? 'border-error focus:ring-error/20 focus:border-error'
            : 'border-neutral-300'
            } ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-4 w-4 text-error" />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-error-fg mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-neutral-500 mt-1">{helperText}</p>
      )}
    </div>
  )
})

const Select = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  required = false,
  options = [],
  placeholder = '',
  children,
  id,
  icon,
  ...props
}, ref) => {
  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = `${selectId}-error`
  const helperId = `${selectId}-helper`

  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-primary-500 text-neutral-400">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full ${icon ? 'pl-10' : 'px-3'} min-h-[44px] md:min-h-[40px] py-2 bg-white border rounded-md text-neutral-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed sm:text-sm appearance-none ${error
            ? 'border-error focus:ring-error/20 focus:border-error'
            : 'border-neutral-300'
            } ${className}`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <div className="absolute inset-y-0 right-0 pr-10 flex items-center pointer-events-none">
            <AlertCircle className="h-4 w-4 text-error" />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-error-fg mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-neutral-500 mt-1">{helperText}</p>
      )}
    </div>
  )
})

const TextArea = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  required = false,
  rows = 3,
  id,
  ...props
}, ref) => {
  const generatedId = useId()
  const textareaId = id || generatedId
  const errorId = `${textareaId}-error`
  const helperId = `${textareaId}-helper`

  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative group">
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full px-3 min-h-[44px] md:min-h-[40px] py-2 bg-white border rounded-md placeholder:text-neutral-400 text-neutral-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed sm:text-sm ${error
            ? 'border-error focus:ring-error/20 focus:border-error'
            : 'border-neutral-300'
            } ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute top-2.5 right-2.5 pointer-events-none">
            <AlertCircle className="h-4 w-4 text-error" />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-error-fg mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-neutral-500 mt-1">{helperText}</p>
      )}
    </div>
  )
})

export { Input, Select, TextArea }
