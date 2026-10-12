// Money colour rules from docs/uiux/DESIGN-SYSTEM.md, in one place so every page agrees.
//   paid / received  -> green   (text-success-fg)
//   owed / overdue   -> red     (text-error-fg), with a "Due" word so colour is never the only signal
//   credit / advance -> green with a minus sign and a "Credit" word
//   zero / unknown   -> quiet neutral
// kind: 'paid' | 'due' | 'overdue'
export function moneyTone (kind, value) {
  const n = Number(value) || 0
  if (n === 0) return 'text-neutral-500'
  if (kind === 'paid') return n > 0 ? 'text-success-fg' : 'text-neutral-800'
  if (kind === 'due') return n > 0 ? 'text-error-fg' : 'text-success-fg'
  if (kind === 'overdue') return n > 0 ? 'text-error-fg' : 'text-neutral-800'
  return 'text-neutral-800'
}

// Short word shown beside a coloured balance. Empty when the amount is zero.
export function moneyWord (kind, value) {
  const n = Number(value) || 0
  if (n === 0 || kind === 'paid') return ''
  if (kind === 'overdue') return n > 0 ? 'Overdue' : ''
  return n > 0 ? 'Due' : 'Credit'
}
