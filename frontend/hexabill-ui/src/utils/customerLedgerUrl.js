const VALID_LEDGER_TABS = new Set(['ledger', 'invoices', 'payments', 'reports'])

/** @param {string | null | undefined} tab */
export function normalizeLedgerTab(tab) {
  return tab && VALID_LEDGER_TABS.has(tab) ? tab : 'ledger'
}

/**
 * @param {URLSearchParams} params
 * @param {{ tab?: string }} state
 */
export function syncLedgerTabSearchParam(params, { tab }) {
  const normalized = normalizeLedgerTab(tab)
  if (normalized === 'ledger') params.delete('tab')
  else params.set('tab', normalized)
}

/** Deep link to customer ledger (e.g. from customer list/detail). */
export function buildCustomerLedgerHref ({ customerId, tab, recordPaymentSaleId, openPayment } = {}) {
  const params = new URLSearchParams()
  if (customerId != null && customerId !== '') params.set('customerId', String(customerId))
  if (recordPaymentSaleId != null && recordPaymentSaleId !== '') {
    params.set('recordPayment', String(recordPaymentSaleId))
  } else if (openPayment) {
    params.set('openPayment', '1')
  }
  syncLedgerTabSearchParam(params, { tab })
  const q = params.toString()
  return q ? `/ledger?${q}` : '/ledger'
}

/** Ledger href to collect on a sale when balance remains; otherwise view ledger. */
export function buildCustomerLedgerCollectHref ({ customerId, saleId, balanceAmount } = {}) {
  const balance = Number(balanceAmount)
  const needsPayment = balance > 0 && saleId != null && saleId !== ''
  return buildCustomerLedgerHref({
    customerId,
    tab: needsPayment ? 'payments' : undefined,
    recordPaymentSaleId: needsPayment ? saleId : undefined
  })
}
