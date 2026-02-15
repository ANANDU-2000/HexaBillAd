// Data Cache Utility for Fast Loading
class DataCache {
  constructor() {
    this.cache = new Map()
    this.cacheTime = new Map()
    this.defaultTTL = 30000 // 30 seconds default TTL
  }

  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, data)
    this.cacheTime.set(key, Date.now() + ttl)
  }

  get(key) {
    const expiry = this.cacheTime.get(key)
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key)
      this.cacheTime.delete(key)
      return null
    }
    return this.cache.get(key)
  }

  invalidate(key) {
    this.cache.delete(key)
    this.cacheTime.delete(key)
  }

  invalidatePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.invalidate(key)
      }
    }
  }

  clear() {
    this.cache.clear()
    this.cacheTime.clear()
  }
}

export const dataCache = new DataCache()

// Cache keys
export const CACHE_KEYS = {
  CUSTOMERS: 'customers',
  CUSTOMER_LEDGER: (id) => `customer_ledger_${id}`,
  CUSTOMER_INVOICES: (id) => `customer_invoices_${id}`,
  CUSTOMER_PAYMENTS: (id) => `customer_payments_${id}`,
  OUTSTANDING_INVOICES: (id) => `outstanding_invoices_${id}`,
  SUMMARY_REPORT: (date) => `summary_report_${date}`,
  SALES_REPORT: (from, to) => `sales_report_${from}_${to}`,
  OUTSTANDING_BILLS: (from, to) => `outstanding_bills_${from}_${to}`
}

