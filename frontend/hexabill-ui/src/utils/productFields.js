// Product form values are repaired instead of rejected. Each fixer returns { value, note } where
// note is a short plain sentence for the client when something was changed (empty when nothing was).
export const MAX_PRICE = 1000000

// Validate before harmless text/decimal formatting. Never guess missing names,
// replace invalid money with zero, or replace a bad stock conversion with one.
export function validateProductFields (form) {
  const errors = {}
  if (!cleanText(form.nameEn)) errors.nameEn = 'Enter the English product name, for example Beef slices 18 kg carton.'
  if (!cleanText(form.sku)) errors.sku = 'Enter a unique product code, for example BEEF-18KG-001.'
  for (const [field, limit, label] of [['sku', 50, 'SKU'], ['barcode', 100, 'Barcode'], ['nameEn', 200, 'English name'], ['nameAr', 200, 'Arabic name'], ['descriptionEn', 500, 'English description'], ['descriptionAr', 500, 'Arabic description']]) {
    if (String(form[field] ?? '').length > limit) errors[field] = `${label} must be ${limit} characters or fewer.`
  }
  if (!cleanText(form.unitType) || String(form.unitType).length > 20) errors.unitType = 'Choose the unit used for this product.'
  for (const [field, label] of [['costPrice', 'Purchase cost'], ['sellPrice', 'Selling price']]) {
    const value = Number(form[field])
    if (form[field] === '' || form[field] == null || !Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
      errors[field] = `${label} must be between 0 and 1,000,000 AED, for example 120.00.`
    }
  }
  const conversion = Number(form.conversionToBase)
  if (!Number.isFinite(conversion) || conversion < 0.0001 || conversion > 999999.99) errors.conversionToBase = 'Enter a conversion between 0.0001 and 999,999.99; use 1 when no conversion is needed.'
  const reorder = Number(form.reorderLevel ?? 0)
  if (!Number.isInteger(reorder) || reorder < 0 || reorder > 2147483647) errors.reorderLevel = 'Enter a whole-number reorder level of 0 or more; use 0 for the company default.'
  return errors
}

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
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.-]/g, '')
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
