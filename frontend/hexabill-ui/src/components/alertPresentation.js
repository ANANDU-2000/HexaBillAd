// Owner-facing wording and grouping for notifications (UX-A05). Pure functions, no React.

const TYPE_LABELS = {
  LowStock: 'Low stock',
  ProductExpiring: 'Expiring soon',
  OverdueInvoice: 'Overdue',
  DBMismatch: 'Stock check',
  BalanceMismatch: 'Balance check',
  DuplicateInvoice: 'Duplicate invoice',
  BackupFailed: 'Backup failed',
  BackupSuccess: 'Backup done',
  PaymentFailed: 'Payment failed',
}

const humanize = (type) => String(type || 'Notice')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/\bDB\b/g, 'Database')

export const alertTypeLabel = (type) => TYPE_LABELS[type] || humanize(type)

export const ALERT_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stock' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'other', label: 'Other' },
]

export function alertCategory (type) {
  if (type === 'LowStock' || type === 'ProductExpiring') return 'stock'
  if (type === 'OverdueInvoice') return 'overdue'
  return 'other'
}

export const countByCategory = (alerts) => {
  const counts = { all: alerts.length, stock: 0, overdue: 0, other: 0 }
  for (const a of alerts) counts[alertCategory(a.type)] += 1
  return counts
}

export const filterByCategory = (alerts, category) =>
  category === 'all' || !category ? alerts : alerts.filter((a) => alertCategory(a.type) === category)

// A message that is just a list of record ids is technical detail, not something to read by default.
const ID_DUMP = /^\s*(product|customer|invoice|payment|supplier)\s+ids?\s*:/i

/**
 * Returns what to show for one alert: { title, message, details }.
 * `details` holds the raw server text and is only filled for Owner/Admin (canSeeDetails).
 */
export function describeAlert (alert, { canSeeDetails = false } = {}) {
  const rawTitle = alert?.title || ''
  const rawMessage = alert?.message || ''

  if (alert?.type === 'DBMismatch') {
    const n = Number((/(\d+)\s+products?/i.exec(rawTitle) || [])[1])
    const title = n > 0 ? `Stock needs a recount for ${n} ${n === 1 ? 'product' : 'products'}` : 'Stock needs a recount'
    return { title, message: '', details: canSeeDetails && rawMessage ? rawMessage : '' }
  }

  if (ID_DUMP.test(rawMessage)) {
    return { title: rawTitle, message: '', details: canSeeDetails ? rawMessage : '' }
  }

  return { title: rawTitle, message: rawMessage, details: '' }
}

export function alertAction (alert) {
  switch (alert?.type) {
    case 'LowStock': return { label: 'View products', path: '/products?tab=lowStock' }
    case 'ProductExpiring': return { label: 'View products', path: '/products' }
    case 'OverdueInvoice': return { label: 'View report', path: '/reports?tab=outstanding' }
    case 'DBMismatch': return { label: 'Review', path: '/products' }
    case 'BalanceMismatch': return { label: 'Review', path: '/ledger' }
    case 'DuplicateInvoice': return { label: 'View sales', path: '/reports?tab=sales' }
    default: return null
  }
}
