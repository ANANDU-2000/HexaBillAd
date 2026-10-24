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
