import api from './api'

export const legacyAPI = {
  getInvoices: async (params = {}) => {
    const response = await api.get('/legacy/invoices', { params })
    return response.data
  },
  getUnifiedInvoices: async (params = {}, config = {}) => {
    const response = await api.get('/legacy/invoices/unified', { params, ...config })
    return response.data
  },
  getInvoiceById: async (id) => {
    const response = await api.get(`/legacy/invoices/${id}`)
    return response.data
  },
  // Printable A4 PDF of a historical invoice (same renderer as live invoices, original issuer identity).
  getInvoicePdf: async (id) => {
    const response = await api.get(`/legacy/invoices/${id}/pdf`, { responseType: 'blob', timeout: 120000, _bypassCache: true })
    return response.data
  },
  getPayments: async (params = {}) => {
    const response = await api.get('/legacy/payments', { params })
    return response.data
  },
  // One chronological, server-paged payment history: this tenant's current payments plus its own historical ones.
  getUnifiedPayments: async (params = {}) => {
    const response = await api.get('/legacy/payments/unified', { params })
    return response.data
  },
  // { historicalCount } for the logged-in tenant; 0 means the tenant has no historical payments.
  getPaymentsSummary: async () => {
    const response = await api.get('/legacy/payments/summary')
    return response.data
  },
  getCustomers: async () => {
    const response = await api.get('/legacy/customers')
    return response.data
  },
  getOpeningReceivables: async () => {
    const response = await api.get('/legacy/opening-receivables')
    return response.data
  },
  getReconciliation: async () => {
    const response = await api.get('/legacy/reconciliation')
    return response.data
  }
,
  getPurchases: async (params = {}) => {
    const response = await api.get('/legacy/purchases', { params })
    return response.data
  },
  getPurchaseById: async (id) => {
    const response = await api.get(`/legacy/purchases/${id}`)
    return response.data
  },
  getExpenses: async (params = {}) => {
    const response = await api.get('/legacy/expenses', { params })
    return response.data
  },
  getSuppliers: async (params = {}) => {
    const response = await api.get('/legacy/suppliers', { params })
    return response.data
  }
};

/** Fetches the historical invoice PDF and opens it in a new tab (same behaviour as live invoice PDFs). */
export async function openLegacyInvoicePdf(id) {
  const blob = await legacyAPI.getInvoicePdf(id)
  const url = window.URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60000)
  if (!opened) throw new Error('Pop-up blocked. Allow pop-ups for this site and try again.')
  return opened
}

/** Reads the server's JSON message from a failed blob request (404/422/500 responses are blobs here). */
export async function legacyPdfErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())
      if (parsed?.message) return parsed.message
    } catch {
      // Not JSON: fall through to the generic message.
    }
  }
  return err?.message && !err?.response ? err.message : fallback
}

export default legacyAPI

