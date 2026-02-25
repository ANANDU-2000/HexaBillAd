/**
 * One-click share invoice/link via WhatsApp (#56).
 * Builds wa.me URL; when phone is provided, opens chat to that number with pre-filled text.
 * Phone: normalized to digits only (e.g. 971501234567 or 0501234567 → 971501234567 with UAE default).
 */

const DEFAULT_COUNTRY_CODE = '971'

/**
 * Normalize phone for wa.me: digits only. If number starts with 0, replace with default country code.
 * @param {string} phone - e.g. "+971 50 123 4567", "0501234567", "971501234567"
 * @returns {string|null} digits only (e.g. "971501234567") or null if empty/invalid
 */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 0) return null
  if (digits.startsWith('0')) {
    return DEFAULT_COUNTRY_CODE + digits.slice(1)
  }
  return digits
}

/**
 * Build WhatsApp share URL. Opens to specific contact when phone is provided.
 * @param {string} message - Pre-filled message (will be encoded)
 * @param {string|null} phone - Optional customer phone (will be normalized)
 * @returns {string} https://wa.me/<phone>?text=... or https://wa.me/?text=...
 */
export function getWhatsAppShareUrl(message, phone = null) {
  const encoded = encodeURIComponent(message || '')
  const normalized = normalizePhoneForWhatsApp(phone)
  if (normalized) {
    return `https://wa.me/${normalized}?text=${encoded}`
  }
  return `https://wa.me/?text=${encoded}`
}
