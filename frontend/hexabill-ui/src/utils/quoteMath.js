/**
 * Quotation line math — matches backend QuotationService.ComputeTotals
 * Acceptance: 10 × 4.25 @ 5% → Tax 2.12, Line 44.62 (midpoint ToEven).
 */

export function roundHalfEven(value, decimals = 2) {
  const factor = 10 ** decimals
  const n = value * factor
  const floor = Math.floor(n)
  const frac = n - floor
  const eps = 1e-10
  if (frac > 0.5 + eps) return (floor + 1) / factor
  if (frac < 0.5 - eps) return floor / factor
  // exactly .5 → nearest even
  return (floor % 2 === 0 ? floor : floor + 1) / factor
}

export function roundAwayFromZero(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** @returns {{ lineNet, vatAmount, lineTotal }} */
export function calcQuoteLine(qty, unitPrice, vatPercent = 5) {
  const lineNet = roundAwayFromZero(Number(qty) * Number(unitPrice), 2)
  const vatAmount = roundHalfEven(lineNet * (Number(vatPercent) / 100), 2)
  const lineTotal = roundAwayFromZero(lineNet + vatAmount, 2)
  return { lineNet, vatAmount, lineTotal }
}

export function calcQuoteTotals(items, discount = 0, defaultVatPercent = 5) {
  let subtotal = 0
  let vatTotal = 0
  const lines = (items || []).map((item) => {
    const rate = item.vatRate > 0 ? Number(item.vatRate) : defaultVatPercent
    const { lineNet, vatAmount, lineTotal } = calcQuoteLine(item.qty, item.unitPrice, rate)
    subtotal += lineNet
    vatTotal += vatAmount
    return { ...item, vatRate: rate, vatAmount, lineTotal, lineNet }
  })
  subtotal = roundAwayFromZero(subtotal, 2)
  vatTotal = roundAwayFromZero(vatTotal, 2)
  const grandTotal = roundAwayFromZero(subtotal + vatTotal - Number(discount || 0), 2)
  return { lines, subtotal, vatTotal, grandTotal }
}
