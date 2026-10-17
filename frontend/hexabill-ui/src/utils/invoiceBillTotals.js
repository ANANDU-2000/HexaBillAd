import { roundMoney } from './currency.js'

// Summarize the supplied invoice rows, preserving the displayed list's scope.
export function invoiceBillTotals(invoices = []) {
  const totalPending = invoices.reduce((sum, invoice) => {
    const paid = Number(invoice.paidAmount ?? 0)
    const total = Number(invoice.grandTotal || invoice.total || 0)
    const returned = Number(invoice.returnedAmount ?? 0)
    return sum + Math.max(0, total - paid - returned)
  }, 0)
  const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? 0), 0)
  return { totalInvoices: invoices.length, totalPaid: roundMoney(totalPaid), totalPending: roundMoney(totalPending) }
}
