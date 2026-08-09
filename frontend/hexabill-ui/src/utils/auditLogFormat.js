import { formatCurrency } from './currency'

/**
 * Action badge styling by action family.
 * @returns {{ label: string, className: string }}
 */
export function getAuditActionBadge(action) {
  const raw = (action || '').trim() || '—'
  const lower = raw.toLowerCase()

  let className = 'bg-neutral-100 text-neutral-700 border-neutral-200'
  if (lower.includes('delete') || lower.includes('clear') || lower.includes('reset')) {
    className = 'bg-red-50 text-red-700 border-red-200'
  } else if (lower.includes('payment')) {
    className = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  } else if (lower.includes('sale') || lower.includes('invoice')) {
    className = 'bg-blue-50 text-blue-800 border-blue-200'
  } else if (lower.includes('customer') || lower.includes('merge')) {
    className = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (lower.includes('expense') || lower.includes('purchase')) {
    className = 'bg-violet-50 text-violet-800 border-violet-200'
  }

  return { label: raw, className }
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  return undefined
}

function fmtId(label, id) {
  if (id == null || id === '') return null
  return `${label} #${id}`
}

function fmtAmount(amount) {
  if (amount == null || amount === '') return null
  const n = Number(amount)
  if (!Number.isFinite(n)) return String(amount)
  return formatCurrency(n)
}

/**
 * Turn audit Details JSON (or plain text) into a short human summary.
 * @returns {{ summary: string, prettyJson: string | null, parsed: object | null }}
 */
export function formatAuditDetails(action, details) {
  if (details == null || String(details).trim() === '') {
    return { summary: '—', prettyJson: null, parsed: null }
  }

  const text = String(details).trim()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    return { summary: text, prettyJson: null, parsed: null }
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { summary: text, prettyJson: JSON.stringify(parsed, null, 2), parsed }
  }

  const prettyJson = JSON.stringify(parsed, null, 2)
  const parts = []
  const lower = (action || '').toLowerCase()

  if (lower.includes('merge')) {
    const survivor = pick(parsed, 'survivorId', 'SurvivorId', 'SurvivorCustomerId')
    const losers = pick(parsed, 'loserIds', 'LoserIds', 'sourceIds', 'SourceIds')
    const rows = pick(parsed, 'rowsMoved', 'RowsMoved')
    const bal = pick(parsed, 'balanceAfter', 'BalanceAfter', 'predictedBalance', 'PredictedSurvivorBalance')
    if (survivor != null) parts.push(`Survivor #${survivor}`)
    if (Array.isArray(losers) && losers.length) parts.push(`Merged ${losers.length} → sources ${losers.join(', ')}`)
    else if (losers != null) parts.push(`Sources ${losers}`)
    if (rows != null) parts.push(`${rows} rows moved`)
    if (bal != null) parts.push(`Balance ${fmtAmount(bal)}`)
  }

  if (parts.length === 0) {
    const paymentId = pick(parsed, 'PaymentId', 'paymentId')
    const invoiceId = pick(parsed, 'InvoiceId', 'invoiceId', 'SaleId', 'saleId')
    const customerId = pick(parsed, 'CustomerId', 'customerId')
    const amount = pick(parsed, 'Amount', 'amount')
    const mode = pick(parsed, 'Mode', 'mode', 'Method', 'method')
    const status = pick(parsed, 'Status', 'status')
    const reference = pick(parsed, 'Reference', 'reference')
    const productId = pick(parsed, 'ProductId', 'productId')
    const expenseId = pick(parsed, 'ExpenseId', 'expenseId')
    const purchaseId = pick(parsed, 'PurchaseId', 'purchaseId')

    if (paymentId != null) parts.push(fmtId('Payment', paymentId))
    if (invoiceId != null) parts.push(fmtId('Invoice', invoiceId))
    if (productId != null) parts.push(fmtId('Product', productId))
    if (expenseId != null) parts.push(fmtId('Expense', expenseId))
    if (purchaseId != null) parts.push(fmtId('Purchase', purchaseId))
    if (customerId != null) parts.push(fmtId('Customer', customerId))
    const amt = fmtAmount(amount)
    if (amt) parts.push(amt)
    if (mode) parts.push(String(mode).toUpperCase())
    if (status) parts.push(String(status))
    if (reference) parts.push(`Ref ${reference}`)
  }

  if (parts.length === 0) {
    // Generic: first few key=value pairs
    const entries = Object.entries(parsed).slice(0, 5)
    for (const [k, v] of entries) {
      if (v == null || v === '') continue
      if (typeof v === 'object') continue
      const key = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
      if (/amount|total|balance|price/i.test(k) && Number.isFinite(Number(v))) {
        parts.push(`${key} ${fmtAmount(v)}`)
      } else {
        parts.push(`${key} ${v}`)
      }
    }
  }

  return {
    summary: parts.length ? parts.filter(Boolean).join(' · ') : '—',
    prettyJson,
    parsed
  }
}

/**
 * Relative time label for recent activity (falls back to locale string).
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatAbsoluteDateTime(dateInput) {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/** Common action filter options for company Activity log */
export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'Payment Created', label: 'Payment Created' },
  { value: 'Payment Updated', label: 'Payment Updated' },
  { value: 'Payment Deleted', label: 'Payment Deleted' },
  { value: 'Sale', label: 'Sale / Invoice' },
  { value: 'CustomerMerge', label: 'Customer Merge' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Product', label: 'Product' },
  { value: 'Delete', label: 'Deletes' }
]
