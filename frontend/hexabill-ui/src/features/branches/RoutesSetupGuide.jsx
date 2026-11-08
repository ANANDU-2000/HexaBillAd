import { Link } from 'react-router-dom'
import { Check } from '../../components/ui/icons'

/**
 * UX-F05: one guided card for an empty Branches & Routes area: 1. Add a branch, 2. Add a route, 3. Add customers to the route.
 * The first unfinished step carries the single primary action. Pass `onAddBranch` / `onAddRoute` where the page can open its own
 * dialogs; otherwise the steps link to the Branches & Routes page.
 */
export default function RoutesSetupGuide ({ branchCount = 0, routeCount = 0, firstRouteId = null, canManage = true, onAddBranch, onAddRoute, className = '' }) {
  const steps = [
    { id: 'branch', title: 'Add a branch', hint: 'A warehouse, shop or office your routes start from.', done: branchCount > 0 },
    { id: 'route', title: 'Add a route', hint: 'A delivery or field-sales round that belongs to a branch.', done: routeCount > 0 },
    { id: 'customers', title: 'Add customers to the route', hint: 'Open the route and add its customers, then put them in visiting order.', done: false },
  ]
  const currentIndex = steps.findIndex((s) => !s.done)

  const action = (step) => {
    if (!canManage) return null
    const primary = 'inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700'
    const secondary = 'inline-flex min-h-[44px] items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
    const cls = steps[currentIndex]?.id === step.id ? primary : secondary
    if (step.id === 'branch') return onAddBranch ? <button type="button" onClick={onAddBranch} className={cls}>Add branch</button> : <Link to="/branches" className={cls}>Add branch</Link>
    if (step.id === 'route') {
      if (branchCount === 0) return null
      return onAddRoute ? <button type="button" onClick={onAddRoute} className={cls}>Add route</button> : <Link to="/branches?tab=routes" className={cls}>Add route</Link>
    }
    if (routeCount === 0) return null
    return <Link to={firstRouteId ? `/routes/${firstRouteId}` : '/branches?tab=routes'} className={cls}>Open a route</Link>
  }

  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-4 ${className}`} data-testid="routes-setup-guide">
      <h2 className="text-base font-semibold text-text-primary">Set up your routes</h2>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3" data-testid={`guide-step-${s.id}`} data-state={s.done ? 'done' : i === currentIndex ? 'current' : 'todo'}>
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${s.done ? 'bg-success text-white' : i === currentIndex ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
              {s.done ? <Check className="h-4 w-4" aria-label="Done" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">{s.title}</p>
              <p className="text-sm text-neutral-700">{s.hint}</p>
              {i === currentIndex && <div className="mt-2">{action(s)}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
