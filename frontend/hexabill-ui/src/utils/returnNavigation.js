import toast from 'react-hot-toast'
import { createElement } from 'react'

/** Human label for router `location.state.returnTo` paths. */
export function getReturnLabel (path) {
  if (!path || typeof path !== 'string') return 'Previous page'
  if (path.startsWith('/billing-history')) return 'Billing history'
  if (path.startsWith('/pos')) return 'POS'
  if (path.startsWith('/sales-ledger')) return 'Sales ledger'
  if (path.startsWith('/ledger')) return 'Customer ledger'
  if (path.startsWith('/customers')) return 'Customers'
  if (path.startsWith('/payments')) return 'Payments'
  if (path.startsWith('/reports')) return 'Reports'
  if (path.startsWith('/dashboard')) return 'Dashboard'
  if (path.startsWith('/branches')) return 'Branch'
  if (path.startsWith('/routes')) return 'Route'
  if (path.startsWith('/suppliers')) return 'Suppliers'
  if (path.startsWith('/purchases')) return 'Purchases'
  if (path.startsWith('/expenses')) return 'Expenses'
  if (path.startsWith('/daily-close')) return 'Daily close'
  return 'Previous page'
}

/** Optional toast after a sub-flow completes (payment, etc.). */
export function showReturnToPrompt (navigate, returnTo) {
  if (!returnTo || typeof navigate !== 'function') return
  const label = getReturnLabel(returnTo)
  toast(
    (t) => createElement(
      'span',
      { className: 'flex flex-wrap items-center gap-2 text-sm' },
      createElement('span', null, `Return to ${label}?`),
      createElement(
        'button',
        {
          type: 'button',
          className: 'rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white',
          onClick: () => {
            toast.dismiss(t.id)
            navigate(returnTo)
          }
        },
        'Go back'
      )
    ),
    { duration: 8000, id: 'return-to-prompt' }
  )
}
