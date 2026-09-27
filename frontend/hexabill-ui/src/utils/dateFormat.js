/**
 * Date format utilities for API compatibility.
 * Backend expects YYYY-MM-DD. Always send this format to avoid parsing issues.
 */

export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Normalize date string to YYYY-MM-DD for API calls.
 * Handles: YYYY-MM-DD, DD-MM-YYYY, Date objects, and locale formats.
 * @param {string|Date} dateInput
 * @returns {string} YYYY-MM-DD or empty string if invalid
 */
export function toYYYYMMDD(dateInput) {
  if (!dateInput) return ''
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput
    const ddmmyyyy = dateInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const d = new Date(dateInput)
    if (!isNaN(d.getTime())) return localDateString(d)
  }
  if (dateInput instanceof Date) {
    if (!isNaN(dateInput.getTime())) return localDateString(dateInput)
  }
  return ''
}
