export function addInvoiceHeaderStyleForUpdate(payload, data) {
  if (!data.invoiceHeaderStyleLocked) {
    payload.INVOICE_HEADER_STYLE = data.invoiceHeaderStyle || 'Legacy'
  }
  return payload
}

/**
 * Invoice numbering start (INVOICE_SERIES_START) is only sent when the owner changed it, so saving unrelated
 * settings never creates, clears or rewrites it.
 */
export function addInvoiceSeriesStartForUpdate(payload, data, initial) {
  const next = String(data?.invoiceSeriesStart ?? '').trim()
  const before = String(initial?.invoiceSeriesStart ?? '').trim()
  if (next !== before) payload.INVOICE_SERIES_START = next
  return payload
}

// UX-005: a blank field keeps the current series; otherwise any whole number, including 0, is accepted.
export function validateInvoiceSeriesStart(v) {
  return String(v ?? '').trim() === '' || /^\d+$/.test(String(v).trim()) || 'Enter a whole number such as 7000'
}

// UX-005B: invoice number width (INVOICE_NUMBER_WIDTH). Digits only, 4-10. Blank keeps the server default (4).
export const INVOICE_NUMBER_WIDTH_MIN = 4
export const INVOICE_NUMBER_WIDTH_MAX = 10
export function validateInvoiceNumberWidth(v) {
  const s = String(v ?? '').trim()
  if (s === '') return true
  if (!/^\d+$/.test(s)) return `Enter a whole number from ${INVOICE_NUMBER_WIDTH_MIN} to ${INVOICE_NUMBER_WIDTH_MAX}`
  const n = Number(s)
  return (n >= INVOICE_NUMBER_WIDTH_MIN && n <= INVOICE_NUMBER_WIDTH_MAX) || `Enter a whole number from ${INVOICE_NUMBER_WIDTH_MIN} to ${INVOICE_NUMBER_WIDTH_MAX}`
}

/** When a start is typed with leading zeros (e.g. '00000'), return the width it implies if larger than current; else null. */
export function autoWidthForStart(start, currentWidth) {
  const s = String(start ?? '').trim()
  if (!/^0\d*$/.test(s) || s.length < 2) return null
  const cur = Number(String(currentWidth ?? '').trim()) || INVOICE_NUMBER_WIDTH_MIN
  const want = Math.min(s.length, INVOICE_NUMBER_WIDTH_MAX)
  return want > cur ? String(want) : null
}

/** Preview of the first invoice number: start zero-padded to width, or null if inputs are invalid/blank. */
export function previewFirstInvoice(start, width) {
  const s = String(start ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const w = validateInvoiceNumberWidth(width) === true && String(width ?? '').trim() !== '' ? Number(String(width).trim()) : INVOICE_NUMBER_WIDTH_MIN
  const digits = s.replace(/^0+(?=\d)/, '')
  return digits.padStart(w, '0')
}

/** Width is only sent when changed; key order puts it before INVOICE_SERIES_START. */
export function addInvoiceNumberWidthForUpdate(payload, data, initial) {
  const next = String(data?.invoiceNumberWidth ?? '').trim()
  const before = String(initial?.invoiceNumberWidth ?? '').trim()
  if (next !== before && next !== '') {
    const hadStart = Object.hasOwn(payload, 'INVOICE_SERIES_START')
    const start = payload.INVOICE_SERIES_START
    delete payload.INVOICE_SERIES_START
    payload.INVOICE_NUMBER_WIDTH = next
    if (hadStart) payload.INVOICE_SERIES_START = start
  }
  return payload
}
