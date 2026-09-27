import { formatCurrency } from './currency'

const SENSITIVE_KEY = /password|secret|apikey|token|connectionstring|authorization/i

const ACTION_LABELS = {
  CustomerMerge: 'Customer merged',
  SupplierMerge: 'Supplier merged',
  SYSTEM_RESET: 'System reset',
  OWNER_DATA_RESET: 'Company data reset',
  TENANT_DATA_CLEAR: 'Company data cleared',
  TENANT_SUBDOMAIN_CHANGED: 'Company address changed'
}

export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'Created', label: 'Created' },
  { value: 'Updated', label: 'Updated' },
  { value: 'Deleted', label: 'Deleted' },
  { value: 'Payment', label: 'Payments' },
  { value: 'Sale', label: 'Sales' },
  { value: 'Purchase', label: 'Purchases' },
  { value: 'Customer', label: 'Customers' },
  { value: 'Product', label: 'Products' },
  { value: 'Expense', label: 'Expenses' },
  { value: 'User', label: 'Users' }
]

export const AUDIT_DATE_RANGES = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' }
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function gstParts(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const map = {}
  for (const part of fmt.formatToParts(d)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return map
}

export function gstTodayYmd() {
  const map = gstParts(new Date())
  if (!map) return ''
  return `${map.year}-${map.month}-${map.day}`
}

export function addCalendarDays(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${mm}-${dd}`
}

export function resolveAuditDateRange(preset, customFrom, customTo) {
  if (!preset) return { fromDate: '', toDate: '' }
  if (preset === 'custom') return { fromDate: customFrom || '', toDate: customTo || '' }
  const today = gstTodayYmd()
  if (preset === 'today') return { fromDate: today, toDate: today }
  if (preset === 'yesterday') {
    const y = addCalendarDays(today, -1)
    return { fromDate: y, toDate: y }
  }
  const back = preset === '7' ? 6 : 29
  return { fromDate: addCalendarDays(today, -back), toDate: today }
}

export function formatAuditDateTime(dateInput) {
  const map = gstParts(dateInput)
  if (!map) return '—'
  const month = MONTHS[Number(map.month) - 1] || map.month
  const hour = map.hour === '24' ? '00' : map.hour
  return `${Number(map.day)} ${month} ${map.year} ${hour}:${map.minute}`
}

export function humanizeAction(action) {
  const raw = (action || '').trim()
  if (!raw) return '—'
  if (ACTION_LABELS[raw]) return ACTION_LABELS[raw]
  const spaced = raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = spaced.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function getAuditActionBadge(action) {
  const raw = (action || '').trim()
  const lower = raw.toLowerCase()
  let className = 'bg-neutral-100 text-neutral-700 border-neutral-200'
  if (lower.includes('fail') || lower.includes('error') || lower.includes('warning')) {
    className = 'bg-amber-50 text-amber-800 border-amber-200'
  } else if (lower.includes('delete') || lower.includes('clear') || lower.includes('reset')) {
    className = 'bg-red-50 text-red-700 border-red-200'
  } else if (lower.includes('payment')) {
    className = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  } else if (lower.includes('update') || lower.includes('edit') || lower.includes('adjust') || lower.includes('reconcil')) {
    className = 'bg-blue-50 text-blue-800 border-blue-200'
  } else if (lower.includes('creat') || lower.includes('allocat') || lower.includes('recorded')) {
    className = 'bg-sky-50 text-sky-800 border-sky-200'
  }
  return { label: humanizeAction(raw), className }
}

export function isDeletedAction(action) {
  const lower = (action || '').toLowerCase()
  return lower.includes('delete') || lower.includes('clear')
}

function pick(obj, ...keys) {
  if (!obj) return undefined
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  return undefined
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY.test(String(key).replace(/[_-]/g, ''))
}

function redactValue(value) {
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? '***' : redactValue(v)
    }
    return out
  }
  return value
}

function parseJson(details) {
  if (details == null) return null
  const text = String(details).trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null
  try {
    const parsed = JSON.parse(text)
    if (parsed == null || typeof parsed !== 'object') return null
    return redactValue(parsed)
  } catch {
    return null
  }
}

function fmtAmount(amount) {
  if (amount == null || amount === '') return null
  const n = Number(amount)
  if (!Number.isFinite(n)) return String(amount)
  return formatCurrency(n)
}

function labelKey(key) {
  return String(key)
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase())
}

function parsePlain(text) {
  const invoice = text.match(/Invoice:\s*([^,\n]+)/i)?.[1]?.trim()
  const total = text.match(/Total:\s*([^,\n]+)/i)?.[1]?.trim()
  const customer = text.match(/Customer:\s*([^,\n]+)/i)?.[1]?.trim()
  const amount = text.match(/Amount:\s*([^,\n]+)/i)?.[1]?.trim()
  return {
    invoice: invoice && !/^deleted by/i.test(invoice) ? invoice : null,
    total: total || null,
    customer: customer && !/^deleted by/i.test(customer) ? customer.replace(/\s*Deleted by:.*$/i, '').trim() : null,
    amount: amount || null
  }
}

const ID_KEYS = /^(id|saleid|invoiceid|paymentid|customerid|productid|expenseid|purchaseid|tenantid|ownerid|userid|deletedby|survivorid)$/i

/**
 * Human record + summary from stored Details. Technical JSON stays out of the table.
 */
export function formatAuditDetails(action, details) {
  const empty = { summary: '—', record: '—', facts: [], technical: null }
  if (details == null || String(details).trim() === '') return empty

  const text = String(details).trim()
  const parsed = parseJson(text)

  if (!parsed || Array.isArray(parsed)) {
    const plain = parsePlain(text)
    const facts = []
    if (plain.customer) facts.push({ label: 'Customer', value: plain.customer })
    if (plain.total) facts.push({ label: 'Amount', value: plain.total })
    else if (plain.amount) facts.push({ label: 'Amount', value: plain.amount })
    const summaryParts = facts.map((f) => (f.label === 'Customer' ? `Customer: ${f.value}` : f.value))
    return {
      summary: summaryParts.length ? summaryParts.join(' · ') : text,
      record: plain.invoice ? `Invoice ${plain.invoice}` : '—',
      facts,
      technical: null
    }
  }

  const invoiceNo = pick(parsed, 'InvoiceNo', 'invoiceNo', 'InvoiceNumber', 'invoiceNumber')
  const invoiceText = pick(parsed, 'Invoice', 'invoice')
  const saleId = pick(parsed, 'SaleId', 'saleId', 'InvoiceId', 'invoiceId')
  const paymentId = pick(parsed, 'PaymentId', 'paymentId')
  const reference = pick(parsed, 'Reference', 'reference')
  const customerName = pick(parsed, 'CustomerName', 'customerName', 'Customer', 'customer')
  const amount = pick(parsed, 'Amount', 'amount', 'GrandTotal', 'grandTotal', 'Total', 'total')
  const mode = pick(parsed, 'Mode', 'mode', 'Method', 'method')
  const status = pick(parsed, 'Status', 'status')
  const productName = pick(parsed, 'ProductName', 'productName', 'Name', 'name')
  const lower = (action || '').toLowerCase()

  let record = '—'
  if (invoiceNo) record = `Invoice ${invoiceNo}`
  else if (typeof invoiceText === 'string' && invoiceText && !/^\d+$/.test(invoiceText)) record = `Invoice ${invoiceText}`
  else if (lower.includes('payment') && paymentId != null) record = `Payment #${paymentId}`
  else if (saleId != null) record = `Invoice #${saleId}`
  else if (paymentId != null) record = `Payment #${paymentId}`
  else if (reference) record = `Ref ${reference}`
  else if (lower.includes('product') && typeof productName === 'string') record = productName
  else if (lower.includes('customer') && typeof customerName === 'string') record = customerName

  const facts = []
  if (customerName && typeof customerName !== 'object') facts.push({ label: 'Customer', value: String(customerName) })
  const amt = fmtAmount(amount)
  if (amt) facts.push({ label: 'Amount', value: amt })
  if (mode) facts.push({ label: 'Method', value: String(mode) })
  if (status) facts.push({ label: 'Status', value: String(status) })
  if (reference && record !== `Ref ${reference}`) facts.push({ label: 'Reference', value: String(reference) })

  if (facts.length === 0) {
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null || v === '' || typeof v === 'object') continue
      if (isSensitiveKey(k) || ID_KEYS.test(k.replace(/[_-]/g, ''))) continue
      const shown = /amount|total|balance|price/i.test(k) && Number.isFinite(Number(v)) ? fmtAmount(v) : String(v)
      facts.push({ label: labelKey(k), value: shown })
      if (facts.length >= 4) break
    }
  }

  const summary = facts
    .map((f) => (f.label === 'Customer' ? `Customer: ${f.value}` : f.label === 'Amount' || f.label === 'Method' || f.label === 'Status' ? f.value : `${f.label} ${f.value}`))
    .join(' · ')

  return {
    summary: summary || '—',
    record,
    facts,
    technical: JSON.stringify(parsed, null, 2)
  }
}

export function diffAuditValues(oldRaw, newRaw) {
  const before = parseJson(oldRaw)
  const after = parseJson(newRaw)
  if ((!before || Array.isArray(before)) && (!after || Array.isArray(after))) return []
  const left = before && !Array.isArray(before) ? before : {}
  const right = after && !Array.isArray(after) ? after : {}
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
  const rows = []
  for (const key of keys) {
    if (isSensitiveKey(key)) continue
    const b = left[key]
    const a = right[key]
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    if ((b != null && typeof b === 'object') || (a != null && typeof a === 'object')) continue
    rows.push({
      label: labelKey(key),
      before: b == null || b === '' ? '—' : String(b),
      after: a == null || a === '' ? '—' : String(a)
    })
    if (rows.length >= 12) break
  }
  return rows
}
