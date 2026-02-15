/**
 * Input validation and sanitization utilities
 * Prevents XSS, SQL injection, and invalid data
 */

export const sanitizeString = (str, maxLength = 1000) => {
  if (!str || typeof str !== 'string') return ''
  // Remove HTML tags and limit length
  return str.replace(/<[^>]*>/g, '').trim().substring(0, maxLength)
}

export const validateEmail = (email) => {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

export const validatePhone = (phone) => {
  if (!phone) return true // Phone is optional
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
  return phoneRegex.test(phone.trim())
}

export const validatePrice = (price, min = 0, max = 1000000) => {
  const num = Number(price)
  return !isNaN(num) && num >= min && num <= max
}

export const validateQuantity = (qty, min = 0, max = 100000) => {
  const num = Number(qty)
  return !isNaN(num) && num >= min && num <= max
}

export const sanitizeNumber = (value, defaultValue = 0) => {
  const num = Number(value)
  return isNaN(num) ? defaultValue : num
}

export const validateInvoiceNumber = (invoiceNo) => {
  if (!invoiceNo || typeof invoiceNo !== 'string') return false
  // Allow alphanumeric with dashes and underscores
  return /^[A-Z0-9_-]+$/i.test(invoiceNo.trim()) && invoiceNo.trim().length <= 50
}

export const validateSKU = (sku) => {
  if (!sku || typeof sku !== 'string') return false
  // Allow alphanumeric with dashes, underscores, and dots
  return /^[A-Z0-9._-]+$/i.test(sku.trim()) && sku.trim().length <= 100
}

