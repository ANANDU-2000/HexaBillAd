import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Package, Building2, CornerDownLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { visibleMoreMenu } from '../navigation/moreMenuConfig'
import { canAccessPage, isAdminOrOwner } from '../utils/roles'

/**
 * Ctrl/Cmd+K palette: jump to any page the user may open, or find a
 * customer, product or supplier through the existing tenant-scoped search APIs.
 */
const SEARCH_DEBOUNCE_MS = 250

const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate()
  const { user, impersonatedTenantId } = useAuth()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)

  const pages = useMemo(() => {
    const groups = visibleMoreMenu(user, { isImpersonating: !!impersonatedTenantId })
    return groups.flatMap((group) =>
      group.items
        .filter((item) => item.href)
        .map((item) => ({ key: `page-${item.id}`, kind: 'Page', label: item.label, hint: group.label, href: item.href, icon: item.icon })),
    )
  }, [user, impersonatedTenantId])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setRecords([])
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const q = query.trim()
    if (q.length < 2) {
      setRecords([])
      setSearching(false)
      return undefined
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const { customersAPI, productsAPI, suppliersAPI } = await import('../services')
      const jobs = []
      if (canAccessPage(user, 'customers')) {
        jobs.push(customersAPI.searchCustomers(q, 5).then((res) => (res?.data || []).map((c) => ({
          key: `customer-${c.id}`, kind: 'Customer', label: c.name, hint: c.phone || '', href: `/customers/${c.id}`, icon: Users,
        }))))
      }
      if (canAccessPage(user, 'products')) {
        jobs.push(productsAPI.searchProducts(q, 5).then((res) => (res?.data || []).map((p) => ({
          key: `product-${p.id}`, kind: 'Product', label: p.nameEn, hint: p.sku || '', href: `/products/${p.id}`, icon: Package,
        }))))
      }
      if (isAdminOrOwner(user)) {
        jobs.push(suppliersAPI.searchSuppliers(q, 5).then((res) => (res?.data || []).map((name) => ({
          key: `supplier-${name}`, kind: 'Supplier', label: name, hint: '', href: `/suppliers/${encodeURIComponent(name)}`, icon: Building2,
        }))))
      }
      const settled = await Promise.allSettled(jobs)
      if (cancelled) return
      setRecords(settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
      setSearching(false)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query, user])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchedPages = q ? pages.filter((p) => p.label.toLowerCase().includes(q)) : pages.slice(0, 8)
    return [...matchedPages.slice(0, 8), ...records]
  }, [pages, records, query])

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(results.length - 1, 0)))
  }, [results.length])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const go = (item) => {
    if (!item) return
    onClose()
    navigate(item.href)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog; the input is the only focus stop.
      e.preventDefault()
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-neutral-900/40 px-3 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and go to"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-surface-border bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-surface-border px-3">
          <Search className="h-[18px] w-[18px] shrink-0 text-neutral-500" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            placeholder="Search pages, customers, products, suppliers…"
            className="h-12 w-full bg-transparent text-base text-text-primary outline-none placeholder:text-neutral-400 md:text-sm"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[active] ? `cp-${results[active].key}` : undefined}
            autoComplete="off"
          />
          <kbd className="hidden rounded border border-surface-border px-1.5 py-0.5 text-micro text-neutral-500 sm:block">Esc</kbd>
        </div>
        <ul id="command-palette-list" ref={listRef} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
          {results.map((item, index) => {
            const Icon = item.icon
            const selected = index === active
            return (
              <li
                key={item.key}
                id={`cp-${item.key}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                className={`mx-1 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 text-sm ${selected ? 'bg-primary-50 text-primary-900' : 'text-text-primary'}`}
              >
                {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="hidden truncate text-xs text-neutral-500 sm:block">{item.hint}</span>}
                <span className="shrink-0 text-micro uppercase tracking-wide text-neutral-400">{item.kind}</span>
                {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />}
              </li>
            )
          })}
          {!results.length && !searching && (
            <li className="px-4 py-6 text-center text-sm text-neutral-500">No matches for “{query.trim()}”.</li>
          )}
          {searching && (
            <li className="px-4 py-2 text-xs text-neutral-500" aria-live="polite">Searching records…</li>
          )}
        </ul>
        <div className="hidden items-center gap-4 border-t border-surface-border px-3 py-2 text-micro text-neutral-500 sm:flex">
          <span><kbd className="font-sans">↑↓</kbd> move</span>
          <span><kbd className="font-sans">Enter</kbd> open</span>
          <span><kbd className="font-sans">Esc</kbd> close</span>
          <span className="ml-auto">Press <kbd className="font-sans">?</kbd> for all shortcuts</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
