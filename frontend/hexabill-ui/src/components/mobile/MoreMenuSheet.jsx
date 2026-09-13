import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import MobileSheet from './MobileSheet'
import { useAuth } from '../../hooks/useAuth'
import { visibleMoreMenu, isItemActive } from '../../navigation/moreMenuConfig'

/**
 * MoreMenuSheet — the "More" bottom sheet (mobile primary >5-tab overflow).
 *
 * Lists every remaining tenant route (grouped: MAIN / BUSINESS / OPERATIONS /
 * INSIGHTS / SYSTEM / ACCOUNT) from the shared moreMenuConfig, with a search
 * field, active-route highlighting and a Sign out action. Built on MobileSheet
 * (Escape + backdrop + docs scroll-lock handled there).
 *
 * Android hardware back: a `pushState` sentinel is pushed while open; popping
 * it closes the sheet. Navigation away (route or Sign out) disarms the sentinel
 * so the pop doesn't yank the user back.
 */
const MoreMenuSheet = ({ open, onClose }) => {
  const { user, logout, impersonatedTenantId } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const sentinelRef = useRef(false)

  const groups = visibleMoreMenu(user, { isImpersonating: !!impersonatedTenantId })

  // Android back: push a sentinel entry while open; popping it closes the sheet.
  useEffect(() => {
    if (!open) return
    history.pushState(null, '')
    sentinelRef.current = true
    const onPop = () => {
      if (sentinelRef.current) {
        sentinelRef.current = false
        onClose && onClose()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (sentinelRef.current) {
        sentinelRef.current = false
        history.back()
      }
    }
  }, [open, onClose])

  // Fresh search each time the sheet opens
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const close = () => onClose && onClose()

  /** Navigate to a route: disarm the sentinel first so back() doesn't revert the navigation. */
  const go = (href) => {
    sentinelRef.current = false
    navigate(href)
    close()
  }

  const signOut = () => {
    sentinelRef.current = false
    logout()
    close()
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(q)) }))
        .filter((g) => g.items.length)
    : groups

  const box = (active) =>
    `flex items-center gap-3 min-h-11 px-4 py-3 rounded-xl bg-white border transition-colors active:bg-neutral-50 ${
      active ? 'border-primary-300 bg-primary-50/50' : 'border-neutral-200'
    }`

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title="More"
      ariaLabel="More options"
    >
      <div>
        {/* Sticky search */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 pt-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a section…"
              autoFocus
              className="w-full pl-10 pr-4 min-h-[44px] text-base border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-secondary">No results match your search.</p>
        ) : (
          <div className="px-4 py-3 space-y-5">
            {visible.map((group) => (
              <section key={group.id}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2 px-1">
                  {group.label}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isItemActive(pathname, item)
                    const isSignOut = item.action?.type === 'signOut'
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => (isSignOut ? signOut() : go(item.href))}
                          className={`${box(active)} w-full text-left`}
                        >
                          <Icon
                            className={`h-5 w-5 shrink-0 ${isSignOut ? 'text-error' : 'text-primary-600'}`}
                            aria-hidden
                          />
                          <span
                            className={`text-sm ${isSignOut ? 'font-medium text-error' : active ? 'font-semibold text-primary-700' : 'font-medium text-text-primary'}`}
                          >
                            {item.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            {/* Safe-area spacer (home indicator) */}
            <div aria-hidden style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }} />
          </div>
        )}
      </div>
    </MobileSheet>
  )
}

export default MoreMenuSheet