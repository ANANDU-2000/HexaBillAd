import { Link } from 'react-router-dom'
import { CheckCircle2, Check, RefreshCw, Volume2 } from '../../components/ui/icons'
import { ttsSupported } from './voice'

const inputClass = 'block w-full min-h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500'

/**
 * One card for every assistant action (UX-E04): title, editable field grid, a warning line, [Confirm] [Edit in full form] [Cancel].
 * It only collects values. Posting is done by the caller through the draft/confirm endpoints; this component never talks to the API.
 *
 * fields: [{ key, label, type?: 'text'|'number'|'date'|'tel'|'select', options?: [{value,label}], required?, wide?, placeholder?, step?, min? }]
 * success: { title, message, href?, linkLabel? }  (replaces the form once the caller has confirmed)
 */
export default function ActionCard ({
  title, icon: Icon, fields, values, onChange, warning = 'Nothing is saved until you confirm.', confirmLabel = 'Confirm',
  busyLabel = 'Saving...', busy = false, error = '', note = '', onConfirm, onEditFull, onCancel, onReadAloud, success = null, testId,
}) {
  if (success) {
    return (
      <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3.5 text-neutral-900" data-testid={testId ? `${testId}-success` : undefined}>
        <div className="flex items-center gap-2 text-sm font-semibold text-success-fg">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          <span>{success.title}</span>
        </div>
        {success.message && <p className="text-sm text-neutral-700">{success.message}</p>}
        {success.href && (
          <div className="border-t border-neutral-100 pt-2">
            <Link to={success.href} className="text-sm font-medium text-primary-700 underline hover:text-primary-800">
              {success.linkLabel || 'Open'}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3.5 text-neutral-900"
      data-testid={testId}
      onSubmit={(e) => { e.preventDefault(); if (!busy) onConfirm?.() }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="h-4 w-4 text-neutral-600" aria-hidden="true" />}
          <span>{title}</span>
        </div>
        {onReadAloud && ttsSupported(globalThis) && (
          <button type="button" onClick={onReadAloud} className="inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-neutral-600 hover:bg-neutral-100" title="Read the details aloud">
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Read
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        {fields.map((f) => {
          const id = `${testId || 'ac'}-${f.key}`
          return (
            <div key={f.key} className={f.wide ? 'col-span-2' : 'col-span-1'}>
              <label htmlFor={id} className="mb-0.5 block text-xs font-medium text-neutral-700">{f.label}{f.required ? ' *' : ''}</label>
              {f.type === 'select' ? (
                <select id={id} className={inputClass} value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  id={id}
                  type={f.type || 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  step={f.step}
                  min={f.min}
                  placeholder={f.placeholder}
                  className={inputClass}
                  value={values[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
              {f.hint && <p className="mt-0.5 text-xs text-neutral-600">{f.hint}</p>}
            </div>
          )
        })}
      </div>

      {note && <p className="text-xs text-neutral-700">{note}</p>}
      {error && <p role="alert" className="text-xs font-medium text-error-fg">{error}</p>}
      <p className="text-xs text-neutral-600">{warning}</p>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2.5">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-10 basis-full items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{busy ? busyLabel : confirmLabel}</span>
        </button>
        {onEditFull && (
          <button type="button" onClick={onEditFull} disabled={busy} className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            Edit in full form
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
