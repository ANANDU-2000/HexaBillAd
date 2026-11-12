import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Underline tabs. One row at every width: on phones the row scrolls sideways inside itself instead of wrapping.
 * A soft fade shows when more tabs are hidden past an edge, and the active tab scrolls into view.
 * tabs: [{ id, label, icon?, badge? }]
 */
const TabNavigation = ({ tabs, activeTab, onChange, className = '', ariaLabel = 'Tabs' }) => {
  const navRef = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = navRef.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    measure()
    const el = navRef.current
    if (!el) return undefined
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [measure, tabs.length])

  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-selected="true"]')
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeTab])

  const fade = edges.left && edges.right ? 'both' : edges.right ? 'right' : edges.left ? 'left' : 'none'
  const mask = {
    both: 'linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)',
    right: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)',
    left: 'linear-gradient(to right, transparent, #000 28px)',
    none: 'none',
  }[fade]

  return (
    <div className={`border-b border-surface-border ${className}`}>
      <nav
        ref={navRef}
        onScroll={measure}
        style={{ WebkitMaskImage: mask, maskImage: mask }}
        className="-mb-px flex gap-1 overflow-x-auto overscroll-x-contain scrollbar-hide"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 md:min-h-[40px] ${
                isActive
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-slate-600 hover:border-neutral-300 hover:text-neutral-900'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              {tab.label}
              {tab.badge != null && tab.badge !== false && (
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default TabNavigation
