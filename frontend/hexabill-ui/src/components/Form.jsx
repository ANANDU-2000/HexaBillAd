import { forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'

const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  required = false,
  icon,
  ...props
}, ref) => {
  return (
    <div className="space-y-1 text-left">
      {label && (
        <label className="block text-sm font-semibold text-neutral-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
          className={`block w-full ${icon ? 'pl-10' : 'px-3'} py-2.5 bg-white border rounded-xl shadow-sm placeholder-gray-400 text-neutral-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 sm:text-sm ${error
            ? 'border-red-300 focus:ring-red-50'
            : 'border-neutral-200'
            } ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm font-medium text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-neutral-500 mt-1">{helperText}</p>
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
  placeholder = 'Select an option',
  children,
  id,
  icon,
  ...props
}, ref) => {
  const selectId = id || props.name || `select-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${selectId}-error`

  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-semibold text-neutral-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`block w-full ${icon ? 'pl-10' : 'px-3'} py-2.5 bg-white border rounded-xl shadow-sm text-neutral-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 sm:text-sm appearance-none ${error
            ? 'border-red-300 focus:ring-red-50'
            : 'border-neutral-200'
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
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-neutral-500 mt-1">{helperText}</p>
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
  const textareaId = id || props.name || `textarea-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${textareaId}-error`

  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-semibold text-neutral-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative group">
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`block w-full px-3 py-2.5 bg-white border rounded-xl shadow-sm placeholder-gray-400 text-neutral-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 sm:text-sm ${error
            ? 'border-red-300 focus:ring-red-50'
            : 'border-neutral-200'
            } ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute top-2.5 right-2.5 pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-neutral-500 mt-1">{helperText}</p>
      )}
    </div>
  )
})

export { Input, Select, TextArea }
