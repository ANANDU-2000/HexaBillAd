// Query + row logic for the invoice picker on /returns/create (UX-A04). Pure, no React.
import { localDateString } from '../../utils/dateFormat.js'

export const PICKER_PAGE_SIZE = 20
export const RECENT_DAYS = 30
export const MIN_SEARCH_CHARS = 2

/**
 * No text: the last 30 days, newest first. Text of 2+ characters: search every date (the server matches
 * invoice number and customer), so an older invoice can still be found. Only reads data, never changes it.
 */
export function buildInvoiceQuery (search, now = new Date()) {
  const text = String(search || '').trim()
  const params = { page: 1, pageSize: PICKER_PAGE_SIZE }
  if (text.length >= MIN_SEARCH_CHARS) {
    params.search = text
    return params
  }
  const from = new Date(now)
  from.setDate(from.getDate() - RECENT_DAYS)
  params.fromDate = localDateString(from)
  params.toDate = localDateString(now)
  return params
}

/** Legacy imported invoices have no return flow, so they are not offered. */
export function pickableInvoices (items) {
  return (Array.isArray(items) ? items : []).filter((s) => s && !s.isLegacy && s.id != null)
}

export const returnHrefForSale = (saleId) => `/returns/create?saleId=${encodeURIComponent(saleId)}`
