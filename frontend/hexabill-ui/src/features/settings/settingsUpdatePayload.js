export function addInvoiceHeaderStyleForUpdate(payload, data) {
  if (!data.invoiceHeaderStyleLocked) {
    payload.INVOICE_HEADER_STYLE = data.invoiceHeaderStyle || 'Legacy'
  }
  return payload
}
