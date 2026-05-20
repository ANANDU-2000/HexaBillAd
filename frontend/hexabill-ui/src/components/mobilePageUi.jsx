/**
 * Shared mobile layout: compact headers, icon tab bars (no vertical tab scroll), ledger cards.
 */

export const mobilePageTitleClass = 'text-base font-bold text-neutral-900 leading-tight'
export const mobilePageSubtitleClass = 'text-xs text-neutral-500 hidden sm:block'
export const mobileLedgerCardClass =
  'rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm text-sm leading-snug'
export const mobileLedgerAmountClass = 'text-base font-bold tabular-nums'
export const mobileLedgerLabelClass = 'text-[11px] font-medium text-neutral-500 uppercase tracking-wide'

/** 4–5 equal tabs: icon on top, short label — fits one row on phone */
export const MobileIconTabBar = ({ tabs, activeId, onChange, className = '' }) => (
  <div
    className={`grid w-full border-b border-neutral-200 bg-white ${className}`}
    style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    role="tablist"
  >
    {tabs.map((tab) => {
      const Icon = tab.icon
      const active = activeId === tab.id
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.id)}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] px-1 py-2 border-b-2 transition-colors ${
            active
              ? 'border-primary-600 text-primary-700 bg-primary-50/80'
              : 'border-transparent text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-primary-600' : 'text-neutral-500'}`} aria-hidden />
          <span className={`text-[10px] leading-tight font-medium truncate max-w-full ${active ? 'font-semibold' : ''}`}>
            {tab.shortLabel || tab.label}
          </span>
        </button>
      )
    })}
  </div>
)

/** Period chips: 2×2 on xs, one row on sm+ — avoids tall vertical stacks */
export const MobilePeriodBar = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-neutral-200 p-3 ${className}`}>
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">{children}</div>
  </div>
)

export const mobilePeriodChipClass = (active) =>
  `min-h-10 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-center ${
    active ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 active:bg-neutral-200'
  }`

/** Horizontal icon actions — no multi-row button wrap on narrow screens */
export const MobileActionStrip = ({ children, className = '' }) => (
  <div
    className={`flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 -mx-1 px-1 scrollbar-hide ${className}`}
  >
    {children}
  </div>
)

export const mobileActionBtnClass =
  'shrink-0 inline-flex items-center justify-center gap-1 min-h-10 px-2.5 text-xs font-medium rounded-lg whitespace-nowrap'

/** Supplier / customer ledger transaction card */
export const MobileLedgerTxnCard = ({
  type,
  reference,
  dateStr,
  debit,
  credit,
  balance,
  formatCurrency,
  formatBalance,
  status,
  actions,
  variant = 'neutral'
}) => {
  const border =
    variant === 'debit' || (debit > 0 && !credit)
      ? 'border-red-200 bg-red-50/40'
      : variant === 'credit' || credit > 0
        ? 'border-green-200 bg-green-50/40'
        : 'border-neutral-200 bg-white'
  const bal = Number(balance) || 0
  return (
    <div className={`${mobileLedgerCardClass} ${border}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{type}</p>
          {reference && <p className="text-xs text-neutral-600 truncate">{reference}</p>}
          <p className="text-xs text-neutral-500 mt-0.5">{dateStr}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={mobileLedgerLabelClass}>Balance</p>
          <p
            className={`${mobileLedgerAmountClass} ${
              bal < 0 ? 'text-green-600' : bal > 0 ? 'text-red-600' : 'text-neutral-900'
            }`}
          >
            {formatBalance(bal)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className={mobileLedgerLabelClass}>Debit</span>
          <p className="font-semibold text-neutral-800 tabular-nums">
            {debit > 0 ? formatCurrency(debit) : '—'}
          </p>
        </div>
        <div>
          <span className={mobileLedgerLabelClass}>Credit</span>
          <p className="font-semibold text-neutral-800 tabular-nums">
            {credit > 0 ? formatCurrency(credit) : '—'}
          </p>
        </div>
      </div>
      {(status || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
          {status && <span className="text-xs font-medium text-neutral-600">{status}</span>}
          {actions && <div className="flex flex-wrap gap-1.5 ml-auto">{actions}</div>}
        </div>
      )}
    </div>
  )
}
