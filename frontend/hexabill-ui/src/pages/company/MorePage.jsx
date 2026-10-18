import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, LayoutGrid } from 'lucide-react'
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
    <div className="p-4 md:p-6 w-full max-w-5xl">
      <header className="flex items-center gap-3 mb-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-text-primary leading-tight">More</h1>
          <p className="text-sm text-text-secondary">Extra tools that are not in the sidebar. Open any card to get started.</p>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-text-secondary">No additional sections available for your role.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`more-${group.id}`}>
              <h2
                id={`more-${group.id}`}
                className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
              >
                {group.label}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isItemActive(pathname, item)
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex h-full items-center gap-4 rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          active
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-neutral-200 bg-white hover:border-primary-300'
                        }`}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                          <Icon className="h-6 w-6" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-semibold ${active ? 'text-primary-700' : 'text-text-primary'}`}>
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="mt-0.5 block text-xs leading-snug text-text-secondary">
                              {item.description}
                            </span>
                          )}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default MorePage
