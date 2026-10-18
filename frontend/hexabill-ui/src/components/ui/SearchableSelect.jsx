import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, ChevronDown, Search, X } from 'lucide-react'
import { pickerKey } from '../../utils/pickerNav'

const LIST_MAX = 240

// At least 320px wide so name, phone and balance fit, but never wider than the screen.
const popoverBox = (pos) => {
  const width = Math.min(Math.max(pos.width, 320), window.innerWidth - 16)
  return { width, left: Math.max(8, Math.min(pos.left, window.innerWidth - width - 8)) }
}

// Drop-in replacement for the shared <Select> when the option list is long. Same props
// (label, options, value, onChange, error, helperText, disabled, required, placeholder) and onChange
// emits { target: { value } } so call sites keep working. Options may carry `meta` (muted text next
// to the label, e.g. phone) and `hint` (right-aligned, e.g. balance). An option with value '' acts as
// the placeholder / "clear" entry and is not listed. The list renders in a portal so a Modal's
// overflow never clips it.
const SearchableSelect = forwardRef(({
  label, error, helperText, className = '', required = false, options = [], placeholder = '',
  id, disabled = false, value, onChange, searchPlaceholder = 'Type to search...', ...rest
}, ref) => {
  const generatedId = useId()
  const selectId = id || generatedId
  const listId = `${selectId}-list`
  const errorId = `${selectId}-error`
  const helperId = `${selectId}-helper`

  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const popRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)

  // Without a `value` prop (react-hook-form's register()) the picker keeps its own value, and exposes it as
  // the element's `.value` so RHF can read it and set it from reset()/setValue() like a native select.
  const controlled = value !== undefined
  const [inner, setInner] = useState('')
  const current = controlled ? value : inner
  const currentRef = useRef(current)
  currentRef.current = current

  const placeholderOpt = options.find(o => String(o.value) === '')
  const emptyLabel = placeholder || placeholderOpt?.label || 'Select'
  const items = useMemo(() => options.filter(o => String(o.value) !== ''), [options])
  const selected = items.find(o => String(o.value) === String(current))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(o => `${o.label} ${o.meta || ''}`.toLowerCase().includes(q))
  }, [items, query])

  const setRefs = (node) => {
    triggerRef.current = node
    if (node && !controlled) {
      Object.defineProperty(node, 'value', {
        configurable: true,
        get: () => currentRef.current,
        set: (v) => { setInner(v == null ? '' : String(v)) },
      })
    }
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  const close = useCallback((refocus = true) => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const flip = below < LIST_MAX + 56 && r.top > below
    setPos({
      left: r.left,
      width: r.width,
      ...(flip ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  // The popover mounts one render after `open` (it waits for its position), so focus once it exists.
  const positioned = open && pos !== null
  useEffect(() => { if (positioned) searchRef.current?.focus() }, [positioned])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      close(false)
    }
    const onMove = (e) => { if (!popRef.current?.contains(e.target)) place() }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', place)
    }
  }, [open, close, place])

  useEffect(() => { setActive(filtered.length > 0 ? 0 : -1) }, [query, open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  // `name` is included so react-hook-form's register() onChange can resolve the field.
  const emit = (next) => {
    if (!controlled) setInner(next)
    onChange?.({ target: { name: rest.name, value: next }, type: 'change' })
  }
  const choose = (opt) => {
    emit(String(opt.value))
    close()
  }
  const clear = (e) => {
    e.stopPropagation()
    emit('')
  }

  const onTriggerKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true) }
  }

  const onSearchKey = (e) => {
    if (e.key === 'Tab') { close(false); return }
    const r = pickerKey(e.key, active, filtered.length)
    if (r.action === 'close') { e.stopPropagation(); e.preventDefault(); close(); return }
    if (r.action === 'open' || r.action === 'select') e.preventDefault()
    if (r.action === 'select') { choose(filtered[r.active]); return }
    setActive(r.active)
  }

  const border = error ? 'border-error focus:ring-error/20 focus:border-error' : 'border-neutral-300'

  return (
    <div className="space-y-1 text-left">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative group">
        <button
          {...rest}
          ref={setRefs}
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={onTriggerKey}
          className={`flex w-full items-center gap-2 px-3 min-h-[44px] md:min-h-[40px] py-2 bg-white border rounded-md text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed sm:text-sm ${border} ${className}`}
        >
          <span className={`min-w-0 flex-1 truncate ${selected ? 'text-neutral-900' : 'text-neutral-400'}`}>
            {selected ? selected.label : emptyLabel}
            {selected?.meta && <span className="ml-2 text-xs text-neutral-500">{selected.meta}</span>}
          </span>
          {selected && !disabled && !required && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={clear}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          {error
            ? <AlertCircle className="h-4 w-4 shrink-0 text-error" aria-hidden />
            : <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />}
        </button>
      </div>
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-error-fg mt-1">{error}</p>}
      {helperText && !error && <p id={helperId} className="text-xs text-neutral-500 mt-1">{helperText}</p>}

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', ...popoverBox(pos), top: pos.top, bottom: pos.bottom }}
          className="z-[70] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <div className="relative border-b border-neutral-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="searchbox"
              aria-label={`Search ${label || rest['aria-label'] || 'options'}`}
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${selectId}-opt-${active}` : undefined}
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              className="h-9 w-full rounded border border-neutral-300 pl-8 pr-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" style={{ maxHeight: LIST_MAX }} className="overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-neutral-500">No match</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${selectId}-opt-${i}`}
                data-idx={i}
                data-value={String(o.value)}
                role="option"
                aria-selected={String(o.value) === String(current)}
                onPointerDown={(e) => { e.preventDefault(); choose(o) }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm ${i === active ? 'bg-primary-50' : ''} ${String(o.value) === String(current) ? 'font-medium' : ''}`}
              >
                <span className="min-w-0 truncate text-neutral-900">
                  {o.label}
                  {o.meta && <span className="ml-2 text-xs text-neutral-500">{o.meta}</span>}
                </span>
                {o.hint && <span className={`shrink-0 text-xs ${o.hintClassName || 'text-neutral-500'}`}>{o.hint}</span>}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
})

SearchableSelect.displayName = 'SearchableSelect'
export default SearchableSelect
