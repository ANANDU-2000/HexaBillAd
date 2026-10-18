import { forwardRef, useId } from 'react'
import { localDateString } from '../../utils/dateFormat'

const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return localDateString(d) }

// Compact single date with Today / Yesterday shortcuts. Same event shape as <Input type="date">:
// onChange receives { target: { name, value } }. Native date input keeps the browser picker and keyboard entry.
const DateField = forwardRef(({ label, value, onChange, error, disabled = false, required = false, id, name, className = '', shortcuts = true, ...rest }, ref) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const set = (v) => onChange?.({ target: { name, value: v }, type: 'change' })
  const chip = 'rounded px-1.5 py-0.5 text-[11px] font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50 disabled:hover:bg-transparent'
  return (
    <div className="space-y-1 text-left">
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700">
            {label}{required && <span className="text-error ml-0.5" aria-hidden>*</span>}
          </label>
        )}
        {shortcuts && (
          <span className="flex shrink-0 gap-0.5">
            <button type="button" disabled={disabled} onClick={() => set(localDateString())} className={chip}>Today</button>
            <button type="button" disabled={disabled} onClick={() => set(shift(-1))} className={chip}>Yesterday</button>
          </span>
        )}
      </div>
      <input
        {...rest} ref={ref} id={inputId} name={name} type="date" value={value || ''} disabled={disabled} required={required}
        aria-invalid={!!error} onChange={onChange}
        className={`block w-full min-h-[44px] md:min-h-0 md:h-9 px-2 bg-white border rounded-md text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 ${error ? 'border-error' : 'border-neutral-300'} ${className}`}
      />
      {error && <p role="alert" className="text-xs font-medium text-error-fg">{error}</p>}
    </div>
  )
})
DateField.displayName = 'DateField'
export default DateField
