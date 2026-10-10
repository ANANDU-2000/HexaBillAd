import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { visibleMoreMenu, isItemActive } from '../../navigation/moreMenuConfig'

/** Desktop /more lists only routes that are not already in the sidebar or shell. */
const MorePage = () => {
  const { user, impersonatedTenantId } = useAuth()
  const { pathname } = useLocation()

  const groups = visibleMoreMenu(user, {
    isImpersonating: !!impersonatedTenantId,
    hideSidebar: true,
    hideShell: true,
  })

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto w-full">
      <h1 className="text-xl font-semibold text-text-primary mb-1">More</h1>
      <p className="text-sm text-text-secondary mb-6">Sections that are not in the sidebar.</p>

      {groups.length === 0 ? (
        <p className="text-sm text-text-secondary">No additional sections available for your role.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const items = group.items
            if (items.length === 0) return null
            return (
              <section key={group.id}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                  {group.label}
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = isItemActive(pathname, item)
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 min-h-11 px-4 py-3 rounded-lg bg-white border transition-colors ${
                            active
                              ? 'border-primary-300 bg-primary-50/50'
                              : 'border-neutral-200 text-text-primary hover:border-primary-300 hover:bg-primary-50/50'
                          }`}
                        >
                          <Icon className="w-5 h-5 text-primary-600 shrink-0" aria-hidden />
                          <span className={`text-sm ${active ? 'font-semibold text-primary-700' : 'font-medium'}`}>
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MorePage