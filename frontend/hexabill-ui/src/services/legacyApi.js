import api from './api'

export const legacyAPI = {
  getInvoices: async (params = {}) => {
    const response = await api.get('/legacy/invoices', { params })
    return response.data
  },
  getUnifiedInvoices: async (params = {}) => {
    const response = await api.get('/legacy/invoices/unified', { params })
    return response.data
  },
  getInvoiceById: async (id) => {
    const response = await api.get(`/legacy/invoices/${id}`)
    return response.data
  },
  getPayments: async (params = {}) => {
    const response = await api.get('/legacy/payments', { params })
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

export default legacyAPI

