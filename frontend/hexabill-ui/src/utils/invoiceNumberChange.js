// UX-008: pure helpers for "Change invoice number" (Owner/Admin). No React/axios so node --test can cover them.

/** Roles allowed to change an issued invoice number (server enforces the same: Admin, Owner). */
export function canChangeInvoiceNumber (role) {
  const r = String(role || '').toLowerCase()
  return r === 'owner' || r === 'admin'
}

/** Rows the server would refuse anyway: deleted sales and sales brought in by a data import. */
export function isRenumberableSale (sale) {
  if (!sale) return false
  if (sale.isDeleted === true || sale.IsDeleted === true) return false
  const ref = String(sale.externalReference ?? sale.ExternalReference ?? '').toLowerCase()
  if (ref.startsWith('starplus:')) return false
  return true
}

/** Keep digits only; leading zeros stay because the value is a string. */
export function sanitizeInvoiceNumberInput (value) {
  return String(value ?? '').replace(/\D+/g, '')
}

/** Client-side check before any request. Returns an error message or null. */
export function validateInvoiceNumberChange ({ current, next, reason }) {
  const n = String(next ?? '').trim()
  if (!n) return { field: 'number', message: 'Enter the new invoice number.' }
  if (!/^\d+$/.test(n)) return { field: 'number', message: 'Use digits only.' }
  if (n.length < 4) return { field: 'number', message: 'Use at least 4 digits.' }
  if (current != null && n === String(current)) return { field: 'number', message: 'This is already the invoice number.' }
  if (!String(reason ?? '').trim()) return { field: 'reason', message: 'Enter a reason for the change.' }
  return null
}

const HIDDEN_WORDS = /starplus|imported/i

/** Turn a failed PUT into one inline message the user can act on. Never leaks internal source names. */
export function mapInvoiceNumberError (status, body) {
  const raw = (body && typeof body === 'object')
    ? String(body.message || (Array.isArray(body.errors) ? body.errors.filter(Boolean)[0] : '') || '')
    : String(body || '')
  if (status === 409) {
    return { kind: 'conflict', message: 'This invoice was changed by someone else. Reload and try again.' }
  }
  if (status === 403) {
    return { kind: 'forbidden', message: 'Only an Owner or Admin can change invoice numbers.' }
  }
  if (status === 404) {
    return { kind: 'notFound', message: 'This invoice could not be found. Reload the list.' }
  }
  if (status === 400) {
    if (/deleted/i.test(raw) && /renumber|cannot|can't/i.test(raw) && !/already issued/i.test(raw)) {
      return { kind: 'invalid', message: 'Deleted invoices can’t have their number changed.' }
    }
    if (HIDDEN_WORDS.test(raw) || /original number/i.test(raw)) {
      return { kind: 'invalid', message: 'This invoice keeps its original number and can’t be changed.' }
    }
    if (/already/i.test(raw)) {
      return { kind: 'invalid', message: 'That number has already been used (including deleted or voided invoices). Choose another.' }
    }
    if (/below|lower than|less than/i.test(raw)) {
      const m = raw.match(/\d{4,}/)
      return { kind: 'invalid', message: m ? `The number must be ${m[0]} or higher.` : 'The number is below the invoice series start.' }
    }
    if (/digit|format|numeric|at least/i.test(raw)) {
      return { kind: 'invalid', message: 'Use digits only, at least 4.' }
    }
    return { kind: 'invalid', message: raw && !HIDDEN_WORDS.test(raw) ? raw : 'That number can’t be used.' }
  }
  if (!status) return { kind: 'network', message: 'Could not reach the server. Check the connection and try again.' }
  return { kind: 'server', message: 'Something went wrong. Nothing was changed. Try again.' }
}
