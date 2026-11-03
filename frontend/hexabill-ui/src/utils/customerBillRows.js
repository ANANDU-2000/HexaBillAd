// Customer ledger "Bills" rows: one source per invoice.
//
// Operating invoices come from the sales report, requested with includeLegacy=false, so the report never
// adds historical rows. Historical Starplus invoices come only from the legacy invoice list. Each record is
// keyed by its own source identity, so the same invoice cannot enter the list twice, and invoice numbers
// alone are never used to decide identity (different customers can share a number).

import { roundMoney } from './currency.js'

export const ALL_DATES_FROM = '2000-01-01'

const pad = (n) => String(n).padStart(2, '0')

// Local business date as yyyy-MM-dd (the same format the date inputs use).
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// One explicit window for BOTH sources. Empty bounds used to be sent as '' which the sales report read as
// "last 30 days" while the legacy list read them as unbounded, so the two sources disagreed.
export function billingDateWindow(range = {}, today = new Date()) {
  return {
    fromDate: range.from || ALL_DATES_FROM,
    toDate: range.to || localDateKey(today),
  }
}

export function operatingBillKey(row) {
  return `operating:${row.id}`
}

export function historicalBillKey(row) {
  return `historical:${row.legacyInvoiceId ?? row.id}`
}

// Merges the two sources and drops any repeated record. Operating rows flagged as historical are ignored
// here because historical invoices are accepted from the historical source only.
export function mergeCustomerBillRows(operatingRows = [], historicalRows = []) {
  const seen = new Set()
  const rows = []
  let duplicatesDropped = 0
  let historicalRowsInOperatingSource = 0

  const add = (row, key) => {
    if (seen.has(key)) {
      duplicatesDropped += 1
      return
    }
    seen.add(key)
    rows.push(row)
  }

  for (const row of operatingRows) {
    if (!row) continue
    if (row.isLegacy) {
      historicalRowsInOperatingSource += 1
      continue
    }
    add(row, operatingBillKey(row))
  }
  for (const row of historicalRows) {
    if (!row) continue
    add({ ...row, isLegacy: true }, historicalBillKey(row))
  }

  return { rows, duplicatesDropped, historicalRowsInOperatingSource }
}

// Outstanding amount across the customer's whole history (not date-filtered). Used for the header balance,
// which previously came from the cached Customers.Balance column and excluded historical pending invoices.
export function canonicalOutstandingBalance(outstandingRows = []) {
  const total = outstandingRows.reduce((sum, row) => sum + Math.max(0, Number(row?.balanceAmount) || 0), 0)
  return roundMoney(total)
}

// Id the customer ledger's payment modal needs to collect on a historical invoice: the negative legacy id,
// the same convention the outstanding list uses. Undefined when the record is deleted, unassigned to a customer,
// or already settled, so nothing can be collected.
export function historicalCollectionId(row) {
  if (!row || !row.isLegacy || row.isDeleted) return undefined
  if (!row.legacyInvoiceId || row.customerId == null) return undefined
  if ((Number(row.outstandingBalance) || 0) <= 0.005) return undefined
  return -row.legacyInvoiceId
}

// The Sales PDF endpoint (/sales/{id}/pdf) resolves live sales only. A historical invoice's id belongs to
// LegacyInvoices and can equal a live sale id in the same tenant (39 such pairs in FrozenHub 1), so a historical
// row must never be sent there. Returns undefined when the row has no printable live sale.
export function salePdfId(row) {
  if (!row || row.isLegacy) return undefined
  const id = Number(row.id)
  return Number.isInteger(id) && id > 0 ? id : undefined
}
