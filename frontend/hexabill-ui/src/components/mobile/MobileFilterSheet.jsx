import { Search, RotateCcw } from 'lucide-react'
import MobileSheet from './MobileSheet'

/**
 * MobileFilterSheet — mobile-first filter UI built on MobileSheet.
 * Renders an optional search field plus a set of full-width selects, with
 * Reset / Apply actions pinned to a safe-area-aware footer.
 *
 * props:
 *  - open, onClose
 *  - title (default "Filters")
 *  - searchTerm / onSearchChange — optional inline search field
 *  - fields: [{ key, label, options: [{value,label}], placeholder? }]
 *  - values: { [key]: value }  (controlled)
 *  - onChange(key, value)
 *  - onReset() — clears all filters
 *  - onApply() — commits and closes
 *  - children — optional extra controls rendered after the fields
 */
const MobileFilterSheet = ({
  open,
  onClose,
  title = 'Filters',
  searchTerm,
  onSearchChange,
  fields = [],
  values = {},
  onChange,
  onReset,
  onApply,
  children,
}) => {
  const apply = () => {
    onApply && onApply()
    onClose()
  }

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={title}
      ariaLabel={`${title} filters`}
      footer={
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-neutral-300 bg-white text-neutral-700 font-medium text-sm active:bg-neutral-100"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg bg-primary-600 text-white font-semibold text-sm active:bg-primary-700"
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="px-4 py-4 space-y-4">
        {searchTerm !== undefined && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 min-h-[44px] text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        )}

        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`fs-${field.key}`} className="block text-sm font-medium text-neutral-700 mb-1.5">
              {field.label}
            </label>
            <select
              id={`fs-${field.key}`}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange && onChange(field.key, e.target.value)}
              className="w-full min-h-[44px] px-3 text-base border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{field.placeholder || `All ${field.label.toLowerCase()}`}</option>
              {(field.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {children}
      </div>
    </MobileSheet>
  )
}

export default MobileFilterSheet