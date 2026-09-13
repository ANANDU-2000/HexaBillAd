import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/**
 * PageHeader — compact consistent page header for data screens.
 * Renders an optional back button on touch screens, the page title and a
 * right-hand action slot. Strips to a single row on phones.
 *
 * props:
 *  - title
 *  - subtitle
 *  - actions — node(s) rendered on the right (icon buttons, CTA)
 *  - backTo — optional route to navigate back to (default browser back)
 *  - showBack — force show/hide back (defaults to showing on <sm only)
 */
const PageHeader = ({ title, subtitle, actions, backTo, showBack }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const canGoBack = !!backTo || (location.key !== 'default' && window.history.length > 1)

  return (
    <div className="flex items-start gap-2 w-full min-w-0">
      {showBack !== false && canGoBack && (
        <button
          type="button"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-lg text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-neutral-900 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  )
}

export default PageHeader