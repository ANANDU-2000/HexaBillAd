/**
 * Date format utilities for API compatibility.
 * Backend expects YYYY-MM-DD. Always send this format to avoid parsing issues.
 */

/**
 * Normalize date string to YYYY-MM-DD for API calls.
 * Handles: YYYY-MM-DD, DD-MM-YYYY, Date objects, and locale formats.
 * @param {string|Date} dateInput
 * @returns {string} YYYY-MM-DD or empty string if invalid
 */
export function toYYYYMMDD(dateInput) {
  if (!dateInput) return ''
  if (typeof dateInput === 'string') {
    // Already YYYY-MM-DD (e.g. from HTML5 date input)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput
    // DD-MM-YYYY
    const ddmmyyyy = dateInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // Try parsing as ISO or other
    const d = new Date(dateInput)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  if (dateInput instanceof Date) {
    if (!isNaN(dateInput.getTime())) return dateInput.toISOString().split('T')[0]
  }
  return ''
}
