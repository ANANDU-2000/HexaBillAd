// Product form values are repaired instead of rejected. Each fixer returns { value, note } where
// note is a short plain sentence for the client when something was changed (empty when nothing was).
export const MAX_PRICE = 1000000

export function cleanText (value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function fixName (value) {
  const clean = cleanText(value)
  return { value: clean, note: clean !== String(value ?? '') ? 'Extra spaces removed from the name.' : '' }
}

// Accepts 12, "12.5", "1,200.50", "AED 12", ".5"; anything unusable becomes 0.
export function fixMoney (value, label = 'Price') {
  if (typeof value === 'number' && Number.isFinite(value)) return fixMoneyNumber(value, label)
  const raw = String(value ?? '').trim()
  if (raw === '') return { value: 0, note: '' }
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.\-]/g, '')
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n)) return { value: 0, note: `${label} was not a number, so it was set to 0.` }
  const out = fixMoneyNumber(n, label)
  if (!out.note && cleaned !== raw) out.note = `${label} was read as ${out.value.toFixed(2)}.`
  return out
}

function fixMoneyNumber (n, label) {
  if (n < 0) return { value: 0, note: `${label} cannot be below 0, so it was set to 0.` }
  if (n > MAX_PRICE) return { value: MAX_PRICE, note: `${label} is limited to ${MAX_PRICE.toLocaleString('en-US')}, so it was lowered.` }
  const rounded = Math.round(n * 100) / 100
  return { value: rounded, note: rounded !== n ? `${label} rounded to 2 decimals (${rounded.toFixed(2)}).` : '' }
}

// How many base units one selected unit holds. Must be above 0; 1 is the safe default.
export function fixConversion (value) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return { value: 1, note: 'Conversion must be above 0, so it was set to 1.' }
  const rounded = Math.round(n * 10000) / 10000
  return { value: rounded, note: rounded !== n ? 'Conversion rounded to 4 decimals.' : '' }
}

export function fixBarcode (value) {
  const clean = String(value ?? '').replace(/\s+/g, '')
  return { value: clean, note: '' }
}
