/**
 * Underline tabs. One row at every width: on phones the row scrolls sideways
 * inside itself instead of wrapping onto several lines.
 * tabs: [{ id, label, icon?, badge? }]
 */
const TabNavigation = ({ tabs, activeTab, onChange, className = '', ariaLabel = 'Tabs' }) => {
  return (
    <div className={`border-b border-surface-border ${className}`}>
      <nav className="-mb-px flex gap-1 overflow-x-auto overscroll-x-contain scrollbar-hide" role="tablist" aria-label={ariaLabel}>
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
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              {tab.label}
              {tab.badge != null && tab.badge !== false && (
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    isActive ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
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
