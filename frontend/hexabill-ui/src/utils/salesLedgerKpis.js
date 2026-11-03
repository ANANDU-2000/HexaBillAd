// View-model for the Sales Ledger KPI strip.
// Inputs are the same filtered figures the table footer uses, so the cards always agree with the rows on screen.
// Formatting (currency, balance colour) happens in the component; this module only picks and orders the values.

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function buildSalesLedgerKpis(summary, { rowCount = 0, returnCount = 0 } = {}) {
  const s = summary || {}
  const returns = Math.max(0, Math.trunc(toNumber(returnCount)))
  return [
    { key: 'sales', label: 'Sales', value: toNumber(s.totalSales), format: 'money', accent: 'primary' },
    {
      key: 'returns',
      label: 'Returns',
      value: toNumber(s.totalReturns),
      format: 'money',
      accent: 'rose',
      helper: `${returns} ${returns === 1 ? 'return' : 'returns'}`,
    },
    { key: 'received', label: 'Received', value: toNumber(s.totalPayments), format: 'money', accent: 'emerald' },
    { key: 'vat', label: 'VAT', value: toNumber(s.totalVat), format: 'money', accent: 'teal' },
    { key: 'unpaid', label: 'Unpaid', value: toNumber(s.totalRealPending), format: 'money', accent: 'amber' },
    { key: 'balance', label: 'Balance', value: toNumber(s.pendingBalance), format: 'balance', accent: 'rose' },
    { key: 'invoices', label: 'Invoices', value: toNumber(s.totalInvoices), format: 'count', accent: 'violet' },
    { key: 'rows', label: 'Rows', value: toNumber(rowCount), format: 'count', accent: 'slate' },
  ]
}
