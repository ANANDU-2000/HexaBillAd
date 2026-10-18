import { localDateString } from '../../utils/dateFormat'

const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return localDateString(d) }

export const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => ({ from: localDateString(), to: localDateString() }) },
  { key: 'yesterday', label: 'Yesterday', range: () => ({ from: shift(-1), to: shift(-1) }) },
  { key: '7d', label: 'Last 7 days', range: () => ({ from: shift(-6), to: localDateString() }) },
  {
    key: 'month',
    label: 'This month',
    range: () => {
      const n = new Date()
      return { from: localDateString(new Date(n.getFullYear(), n.getMonth(), 1)), to: localDateString(new Date(n.getFullYear(), n.getMonth() + 1, 0)) }
    },
  },
  {
    key: 'lastmonth',
    label: 'Last month',
    range: () => {
      const n = new Date()
      return { from: localDateString(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: localDateString(new Date(n.getFullYear(), n.getMonth(), 0)) }
    },
  },
  { key: 'all', label: 'All dates', range: () => ({ from: '', to: '' }) },
]

const chip = 'min-h-[44px] md:min-h-0 md:h-7 rounded-full border px-3 text-xs font-medium transition-colors'
const field = 'min-h-[44px] md:min-h-0 md:h-9 w-full min-w-0 rounded-md border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500'

// Preset chips only, for pages that keep their own From/To inputs. onChange receives { from, to }.
export function DatePresetChips({ from, to, onChange, className = '', presets }) {
  const list = presets ? DATE_PRESETS.filter(p => presets.includes(p.key)) : DATE_PRESETS
  const active = DATE_PRESETS.find(p => { const r = p.range(); return r.from === (from || '') && r.to === (to || '') })?.key
  return (
    <div role="group" aria-label="Quick date ranges" className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map(p => (
        <button key={p.key} type="button" aria-pressed={active === p.key} onClick={() => onChange(p.range())}
          className={`${chip} ${active === p.key ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// Compact From/To dates plus one-click presets. Controlled: onChange receives { from, to } ('' = open end).
export default function DateRangeFilter({ from, to, onChange, error, label = 'Date range' }) {
  const active = DATE_PRESETS.find(p => { const r = p.range(); return r.from === (from || '') && r.to === (to || '') })?.key
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <label className="w-36 text-xs font-medium text-neutral-700">
        From date
        <input type="date" value={from || ''} max={to || undefined} aria-invalid={Boolean(error)}
          onChange={(e) => onChange({ from: e.target.value, to: to || '' })}
          className={`mt-1 ${field} ${error ? 'border-error' : 'border-neutral-300'}`} />
      </label>
      <label className="w-36 text-xs font-medium text-neutral-700">
        To date
        <input type="date" value={to || ''} min={from || undefined} aria-invalid={Boolean(error)}
          onChange={(e) => onChange({ from: from || '', to: e.target.value })}
          className={`mt-1 ${field} ${error ? 'border-error' : 'border-neutral-300'}`} />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map(p => (
          <button key={p.key} type="button" aria-pressed={active === p.key}
            onClick={() => onChange(p.range())}
            className={`${chip} ${active === p.key ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
