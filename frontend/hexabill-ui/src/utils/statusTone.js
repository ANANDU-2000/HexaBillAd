// One colour per status meaning, using the design-system tokens (docs/uiux/DESIGN-SYSTEM.md).
//   success (green)  paid, cleared, received
//   warning (amber)  partly paid, returned goods, cheque waiting
//   error   (red)    unpaid, overdue, bounced cheque
//   neutral (grey)   void, draft, unknown
// context 'invoice': "pending" means not yet paid.  context 'cheque': "pending" means waiting to clear.
const TONES = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  error: 'bg-error-bg text-error-fg',
  neutral: 'bg-neutral-100 text-neutral-700',
}
const BORDERS = {
  success: 'border-success-border',
  warning: 'border-warning-border',
  error: 'border-error-border',
  neutral: 'border-neutral-300',
}

export function statusKind (status, context = 'invoice') {
  const s = String(status || '').trim().toLowerCase()
  if (['paid', 'cleared', 'received', 'settled', 'posted'].includes(s)) return 'success'
  if (['partial', 'partially paid', 'returned'].includes(s) && !(context === 'cheque' && s === 'returned')) return 'warning'
  if (s === 'pending') return context === 'cheque' ? 'warning' : 'error'
  if (['unpaid', 'overdue', 'bounced', 'failed', 'returned'].includes(s)) return 'error'
  return 'neutral'
}

export function statusTone (status, context = 'invoice', { border = false } = {}) {
  const kind = statusKind(status, context)
  return border ? `${TONES[kind]} ${BORDERS[kind]}` : TONES[kind]
}

/** Plain label for an invoice payment status: red Unpaid, amber Partial, green Paid. */
export function statusLabel (status, context = 'invoice') {
  const kind = statusKind(status, context)
  const raw = String(status || '').trim()
  const lower = raw.toLowerCase()
  if (context === 'invoice') {
    if (kind === 'success') return '✓ Paid'
    if (lower === 'partial' || lower === 'partially paid') return '● Partial'
    if (lower === 'pending' || lower === 'unpaid') return '● Unpaid / Pending'
  }
  return raw
}
