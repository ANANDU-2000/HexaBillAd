import api from './api'

export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot', { email })
    return response.data
  },

  validateToken: async () => {
    const response = await api.get('/auth/validate')
    return response.data
  },
}

export const productsAPI = {
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params })
    return response.data
  },

  getProduct: async (id) => {
    const response = await api.get(`/products/${id}`)
    return response.data
  },

  createProduct: async (product) => {
    const response = await api.post('/products', product)
    return response.data
  },

  updateProduct: async (id, product) => {
    const response = await api.put(`/products/${id}`, product)
    return response.data
  },

  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`)
    return response.data
  },

  adjustStock: async (id, adjustment) => {
    const response = await api.post(`/products/${id}/adjust-stock`, adjustment)
    return response.data
  },

  getLowStockProducts: async () => {
    const response = await api.get('/products/low-stock')
    return response.data
  },

  searchProducts: async (query, limit = 20) => {
    const response = await api.get('/products/search', { params: { q: query, limit } })
    return response.data
  },

  importExcel: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/products/import-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  resetAllStock: async () => {
    const response = await api.post('/products/reset-all-stock')
    return response.data
  },
}

export const salesAPI = {
  getSales: async (params = {}) => {
    const response = await api.get('/sales', { params })
    return response.data
  },

  getSale: async (id) => {
    const response = await api.get(`/sales/${id}`)
    return response.data
  },

  createSale: async (sale) => {
    const response = await api.post('/sales', sale)
    return response.data
  },

  createSaleWithOverride: async (sale, reason) => {
    const response = await api.post('/sales/override', { saleRequest: sale, reason })
    return response.data
  },
  updateSale: async (id, sale) => {
    const response = await api.put(`/sales/${id}`, sale)
    return response.data
  },
  unlockInvoice: async (id, reason) => {
    const response = await api.post(`/sales/${id}/unlock`, { reason })
    return response.data
  },
  deleteSale: async (id) => {
    const response = await api.delete(`/sales/${id}`)
    return response.data
  },

  getInvoicePdf: async (id) => {
    try {
      const response = await api.get(`/sales/${id}/pdf`, {
        responseType: 'blob'
      })

      // Check content type from response headers
      const contentType = response.headers['content-type'] || ''

      // If response status is error or content-type is JSON, it's an error
      if (response.status >= 400 || contentType.includes('application/json')) {
        // Response is an error - try to parse JSON from blob
        const text = await response.data.text()
        try {
          const errorData = JSON.parse(text)
          const errorMessage = errorData?.message || errorData?.errors?.join(', ') || 'Failed to generate PDF'
          throw new Error(errorMessage)
        } catch (parseError) {
          throw new Error(`Server error: ${response.status}`)
        }
      }

      // Validate it's actually a PDF blob
      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error('Invalid PDF data received from server')
      }

      // Verify content type is PDF
      if (contentType && !contentType.includes('pdf') && !contentType.includes('application/octet-stream')) {
        console.warn('Unexpected content type for PDF:', contentType)
        // Still return the blob - might be valid PDF with wrong header
      }

      // Valid PDF blob
      return response.data
    } catch (error) {
      // If it's an axios error with response
      if (error.response) {
        const contentType = error.response.headers['content-type'] || ''

        // If error response is JSON (axios auto-parsed it)
        if (contentType.includes('application/json')) {
          const errorData = error.response.data
          const errorMessage = errorData?.message || errorData?.errors?.join(', ') || 'Failed to generate PDF'
          throw new Error(errorMessage)
        }

        // If error response is blob (might be JSON error wrapped as blob)
        if (error.response.data instanceof Blob) {
          try {
            // Read blob as text to check if it's JSON error
            const text = await error.response.data.text()
            if (text.trim().startsWith('{')) {
              const errorData = JSON.parse(text)
              throw new Error(errorData.message || errorData.errors?.join(', ') || 'Failed to generate PDF')
            }
            throw new Error(`Server error: ${error.response.status}`)
          } catch (parseError) {
            if (parseError.message) {
              throw parseError
            }
            throw new Error(`Server error: ${error.response.status}`)
          }
        }
      }

      // Re-throw with message
      throw new Error(error.message || 'Failed to generate PDF')
    }
  },

  sendInvoiceEmail: async (id, email) => {
    const response = await api.post(`/sales/${id}/email`, { email })
    return response.data
  },

  getCombinedInvoicesPdf: async (invoiceIds) => {
    try {
      const response = await api.post(`/sales/combined-pdf`,
        { invoiceIds },
        { responseType: 'blob' }
      )

      const contentType = response.headers['content-type'] || ''

      if (response.status >= 400 || contentType.includes('application/json')) {
        const text = await response.data.text()
        try {
          const errorData = JSON.parse(text)
          const errorMessage = errorData?.message || errorData?.errors?.join(', ') || 'Failed to generate combined PDF'
          throw new Error(errorMessage)
        } catch (parseError) {
          throw new Error(`Server error: ${response.status}`)
        }
      }

      return response.data
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'] || ''

        if (contentType.includes('application/json')) {
          const errorData = error.response.data
          const errorMessage = errorData?.message || errorData?.errors?.join(', ') || 'Failed to generate combined PDF'
          throw new Error(errorMessage)
        }

        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text()
            if (text.trim().startsWith('{')) {
              const errorData = JSON.parse(text)
              throw new Error(errorData.message || errorData.errors?.join(', ') || 'Failed to generate combined PDF')
            }
            throw new Error(`Server error: ${error.response.status}`)
          } catch (parseError) {
            if (parseError.message) {
              throw parseError
            }
            throw new Error(`Server error: ${error.response.status}`)
          }
        }
      }

      throw new Error(error.message || 'Failed to generate combined PDF')
    }
  },

  getNextInvoiceNumber: async () => {
    const response = await api.get('/sales/next-invoice-number')
    return response.data
  },

  validateInvoiceNumber: async (invoiceNumber, excludeSaleId = null) => {
    const response = await api.post('/sales/validate-invoice-number', {
      invoiceNumber,
      excludeSaleId
    })
    return response.data
  },

  // CRITICAL: Reconcile all invoice payment statuses with actual payments
  // Fixes any discrepancies between Sale.PaymentStatus and Payments table
  reconcilePaymentStatus: async () => {
    const response = await api.post('/sales/reconcile-payment-status')
    return response.data
  },
}

export const purchasesAPI = {
  getPurchases: async (params = {}) => {
    const response = await api.get('/purchases', { params })
    return response.data
  },

  getPurchaseAnalytics: async (params = {}) => {
    const response = await api.get('/purchases/analytics', { params })
    return response.data
  },

  getPurchase: async (id) => {
    const response = await api.get(`/purchases/${id}`)
    return response.data
  },

  createPurchase: async (purchase) => {
    const response = await api.post('/purchases', purchase)
    return response.data
  },

  updatePurchase: async (id, purchase) => {
    const response = await api.put(`/purchases/${id}`, purchase)
    return response.data
  },

  deletePurchase: async (id) => {
    const response = await api.delete(`/purchases/${id}`)
    return response.data
  },
}

export const customersAPI = {
  getCustomers: async (params = {}) => {
    const response = await api.get('/customers', { params })
    return response.data
  },

  searchCustomers: async (query, limit = 20) => {
    const response = await api.get('/customers/search', { params: { q: query, limit } })
    return response.data
  },

  getCustomer: async (id) => {
    const response = await api.get(`/customers/${id}`)
    return response.data
  },

  createCustomer: async (customer) => {
    const response = await api.post('/customers', customer)
    return response.data
  },

  updateCustomer: async (id, customer) => {
    const response = await api.put(`/customers/${id}`, customer)
    return response.data
  },

  deleteCustomer: async (id, forceDelete = false) => {
    const response = await api.delete(`/customers/${id}`, {
      params: { forceDelete }
    })
    return response.data
  },

  getCustomerLedger: async (id, params = {}) => {
    const { branchId, routeId, staffId, fromDate, toDate } = params
    const query = new URLSearchParams()
    if (branchId != null) query.set('branchId', branchId)
    if (routeId != null) query.set('routeId', routeId)
    if (staffId != null) query.set('staffId', staffId)
    if (fromDate) query.set('fromDate', fromDate)
    if (toDate) query.set('toDate', toDate)
    const url = query.toString() ? `/customers/${id}/ledger?${query}` : `/customers/${id}/ledger`
    const response = await api.get(url)
    return response.data
  },

  getCashCustomerLedger: async () => {
    const response = await api.get('/customers/cash-customer/ledger')
    return response.data
  },

  getOutstandingInvoices: async (id) => {
    const response = await api.get(`/customers/${id}/outstanding-invoices`)
    return response.data
  },

  recalculateBalance: async (id) => {
    const response = await api.post(`/customers/${id}/recalculate-balance`)
    return response.data
  },

  getCustomerStatement: async (id, fromDate, toDate) => {
    const response = await api.get(`/customers/${id}/statement`, {
      params: { fromDate, toDate },
      responseType: 'blob'
    })
    return response.data
  },

  getCustomerPendingBillsPdf: async (id, fromDate, toDate) => {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get(`/customers/${id}/pending-bills-pdf`, {
      params,
      responseType: 'blob'
    })
    return response.data
  },
}

export const paymentsAPI = {
  getPayments: async (params = {}) => {
    const response = await api.get('/payments', { params })
    return response.data
  },

  getPayment: async (id) => {
    const response = await api.get(`/payments/${id}`)
    return response.data
  },

  createPayment: async (payment, idempotencyKey = null) => {
    const headers = {}
    // Generate idempotency key if not provided (for duplicate prevention)
    const key = idempotencyKey || crypto.randomUUID()
    headers['Idempotency-Key'] = key

    try {
      const response = await api.post('/payments', payment, { headers })
      return response.data
    } catch (error) {
      // Handle HTTP 409 Conflict (concurrent modification)
      if (error.response?.status === 409) {
        throw new Error('CONFLICT: Another user updated this invoice. Please refresh and try again.')
      }
      throw error
    }
  },

  updateChequeStatus: async (id, status) => {
    const response = await api.put(`/payments/${id}/cheque-status`, { status })
    return response.data
  },

  updatePaymentStatus: async (id, status) => {
    const response = await api.put(`/payments/${id}/status`, { status })
    return response.data
  },

  getOutstandingInvoices: async (customerId) => {
    const response = await api.get(`/payments/customers/${customerId}/outstanding-invoices`)
    return response.data
  },

  getInvoiceAmount: async (invoiceId) => {
    const response = await api.get(`/payments/invoices/${invoiceId}/amount`)
    return response.data
  },

  allocatePayment: async (allocation) => {
    const response = await api.post('/payments/allocate', allocation)
    return response.data
  },

  updatePayment: async (id, paymentData) => {
    const response = await api.put(`/payments/${id}`, paymentData)
    return response.data
  },

  deletePayment: async (id) => {
    const response = await api.delete(`/payments/${id}`)
    return response.data
  },
}

export const expensesAPI = {
  getExpenses: async (params = {}) => {
    const response = await api.get('/expenses', { params })
    return response.data
  },

  getExpense: async (id) => {
    const response = await api.get(`/expenses/${id}`)
    return response.data
  },

  createExpense: async (expense) => {
    const response = await api.post('/expenses', expense)
    return response.data
  },

  updateExpense: async (id, expense) => {
    const response = await api.put(`/expenses/${id}`, expense)
    return response.data
  },

  deleteExpense: async (id) => {
    const response = await api.delete(`/expenses/${id}`)
    return response.data
  },

  getExpenseCategories: async () => {
    const response = await api.get('/expenses/categories')
    return response.data
  },

  getExpensesAggregated: async (params = {}) => {
    const response = await api.get('/expenses/aggregated', { params })
    return response.data
  },

  createCategory: async (categoryData) => {
    const response = await api.post('/expenses/categories', categoryData)
    return response.data
  },
}

export const reportsAPI = {
  getSummaryReport: async (params = {}) => {
    const response = await api.get('/reports/summary', { params })
    return response.data
  },

  getSalesReport: async (params = {}) => {
    const response = await api.get('/reports/sales', { params })
    return response.data
  },
  getEnhancedSalesReport: async (params = {}) => {
    const response = await api.get('/reports/sales-enhanced', { params })
    return response.data
  },
  getProductSalesReport: async (params = {}) => {
    const response = await api.get('/reports/product-sales', { params })
    return response.data
  },
  getEnhancedProductSalesReport: async (params = {}) => {
    const response = await api.get('/reports/products-enhanced', { params })
    return response.data
  },
  getOutstandingCustomers: async (params = {}) => {
    const response = await api.get('/reports/outstanding', { params })
    return response.data
  },
  getCustomerReport: async (params = {}) => {
    const response = await api.get('/reports/customers-enhanced', { params })
    return response.data
  },
  getAgingReport: async (params = {}) => {
    const response = await api.get('/reports/aging', { params })
    return response.data
  },
  getStockReport: async (params = {}) => {
    const response = await api.get('/reports/stock', { params })
    return response.data
  },
  getComprehensiveSalesLedger: async (params = {}) => {
    const response = await api.get('/reports/sales-ledger', { params })
    return response.data
  },

  getChequeReport: async () => {
    const response = await api.get('/reports/cheque')
    return response.data
  },

  getAISuggestions: async (params = {}) => {
    const response = await api.get('/reports/ai-suggestions', { params })
    return response.data
  },

  getPendingBills: async (params = {}) => {
    const response = await api.get('/reports/pending', { params })
    return response.data
  },

  exportPendingBillsPdf: async (params = {}) => {
    const response = await api.get('/reports/pending-bills/export/pdf', { params, responseType: 'blob' })
    return response.data
  },

  getExpensesByCategory: async (params = {}) => {
    const response = await api.get('/reports/expenses', { params })
    return response.data
  },

  getSalesVsExpenses: async (params = {}) => {
    const response = await api.get('/reports/sales-vs-expenses', { params })
    return response.data
  },

  exportReportPdf: async (params = {}) => {
    const response = await api.get('/reports/export/pdf', { params, responseType: 'blob' })
    return response.data
  },

  exportReportExcel: async (params = {}) => {
    const response = await api.get('/reports/export/excel', { params, responseType: 'blob' })
    return response.data
  },

  exportReportCsv: async (params = {}) => {
    const response = await api.get('/reports/export/csv', { params, responseType: 'blob' })
    return response.data
  },
}

// Settings API (used by OnboardingWizard and Settings page)
export const settingsAPI = {
  getSettings: async () => {
    const response = await api.get('/settings')
    return response.data
  },
  updateSettings: async (settings) => {
    const response = await api.put('/settings', settings)
    return response.data
  },
  clearData: async () => {
    const response = await api.post('/settings/clear-data')
    return response.data
  }
}

export const adminAPI = {
  getSettings: async () => {
    const response = await api.get('/settings')
    return response.data
  },

  updateSettings: async (settings) => {
    const response = await api.put('/settings', settings)
    return response.data
  },

  uploadLogo: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/admin/logo/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  deleteLogo: async () => {
    const response = await api.delete('/admin/logo')
    return response.data
  },

  createBackup: async () => {
    const response = await api.post('/admin/backup')
    return response.data
  },

  createFullBackup: async (exportToDesktop = false) => {
    const response = await api.post(`/admin/backup/full?exportToDesktop=${exportToDesktop}`)
    return response.data
  },

  getBackups: async () => {
    const response = await api.get('/admin/backups')
    return response.data
  },

  getBackupList: async () => {
    const response = await api.get('/admin/backup/list')
    return response.data
  },

  downloadBackup: async (fileName) => {
    const response = await api.get(`/admin/backup/download/${fileName}`, { responseType: 'blob' })
    return response.data
  },

  restoreBackup: async (fileName) => {
    const response = await api.post('/admin/backup/restore', { fileName })
    return response.data
  },

  restoreBackupFromUpload: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/admin/backup/restore-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  deleteBackup: async (fileName) => {
    const response = await api.delete(`/admin/backup/${fileName}`)
    return response.data
  },

  emailBackup: async (fileName, email) => {
    const response = await api.post('/admin/backup/email', { fileName, email })
    return response.data
  },

  getAuditLogs: async (params = {}) => {
    const response = await api.get('/admin/audit-logs', { params })
    return response.data
  },

  getUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params })
    return response.data
  },

  createUser: async (userData) => {
    const response = await api.post('/admin/users', userData)
    return response.data
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/admin/users/${id}`, userData)
    return response.data
  },

  resetPassword: async (id, passwordData) => {
    const response = await api.post(`/admin/users/${id}/reset-password`, passwordData)
    return response.data
  },
}

// Import API - Sales Ledger (Excel/CSV from old app)
export const importAPI = {
  parseSalesLedger: async (file, maxRows = 500) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/import/sales-ledger/parse?maxRows=${maxRows}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },
  applySalesLedger: async (body) => {
    const response = await api.post('/import/sales-ledger/apply', body)
    return response.data
  }
}

// Alerts API
export const alertsAPI = {
  getAlerts: async (params = {}) => {
    const response = await api.get('/alerts', { params })
    return response.data
  },
  getUnreadCount: async () => {
    const response = await api.get('/alerts/unread-count')
    return response.data
  },
  markAsRead: async (id) => {
    const response = await api.post(`/alerts/${id}/read`)
    return response.data
  },
  markAsResolved: async (id) => {
    const response = await api.post(`/alerts/${id}/resolve`)
    return response.data
  },
  markAllAsRead: async () => {
    const response = await api.post('/alerts/mark-all-read')
    return response.data
  },
  clearResolved: async () => {
    const response = await api.post('/alerts/clear-resolved')
    return response.data
  }
}

// Validation API (Admin only)
export const validationAPI = {
  validateCustomer: async (customerId) => {
    const response = await api.get(`/validation/customer/${customerId}`)
    return response.data
  },
  detectMismatches: async () => {
    const response = await api.get('/validation/detect-mismatches')
    return response.data
  },
  fixCustomer: async (customerId) => {
    const response = await api.post(`/validation/fix-customer/${customerId}`)
    return response.data
  },
  fixAll: async () => {
    const response = await api.post('/validation/fix-all')
    return response.data
  },
  recalculateCustomer: async (customerId) => {
    const response = await api.post(`/validation/recalculate/${customerId}`)
    return response.data
  }
}

// Returns API
export const returnsAPI = {
  createSaleReturn: async (data) => {
    const response = await api.post('/returns/sales', data)
    return response.data
  },
  createPurchaseReturn: async (data) => {
    const response = await api.post('/returns/purchases', data)
    return response.data
  },
  getSaleReturns: async (saleId = null) => {
    const params = saleId ? { saleId } : {}
    const response = await api.get('/returns/sales', { params })
    return response.data
  },
  getPurchaseReturns: async (purchaseId = null) => {
    const params = purchaseId ? { purchaseId } : {}
    const response = await api.get('/returns/purchases', { params })
    return response.data
  }
}

// Profit API
export const profitAPI = {
  getProfitReport: async (fromDate, toDate) => {
    const response = await api.get('/profit/report', {
      params: { fromDate, toDate }
    })
    return response.data
  },
  getProductProfit: async (fromDate, toDate) => {
    const response = await api.get('/profit/products', {
      params: { fromDate, toDate }
    })
    return response.data
  },
  getDailyProfit: async (date) => {
    const response = await api.get('/profit/daily', {
      params: { date }
    })
    return response.data
  }
}

// Stock Adjustments API
export const stockAdjustmentsAPI = {
  createAdjustment: async (data) => {
    const response = await api.post('/stockadjustments', data)
    return response.data
  },
  getAdjustments: async (productId = null, fromDate = null, toDate = null) => {
    const params = {}
    if (productId) params.productId = productId
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get('/stockadjustments', { params })
    return response.data
  }
}

// Suppliers API
export const suppliersAPI = {
  getSupplierBalance: async (supplierName) => {
    const response = await api.get(`/suppliers/balance/${encodeURIComponent(supplierName)}`)
    return response.data
  },
  getSupplierTransactions: async (supplierName, fromDate = null, toDate = null) => {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get(`/suppliers/transactions/${encodeURIComponent(supplierName)}`, { params })
    return response.data
  },
  getAllSuppliersSummary: async () => {
    const response = await api.get('/suppliers/summary')
    return response.data
  }
}

// Backup API
export const backupAPI = {
  createBackup: async (exportToDesktop = true, uploadToGoogleDrive = false, sendEmail = false) => {
    const response = await api.post('/backup/create', null, {
      params: { exportToDesktop, uploadToGoogleDrive, sendEmail }
    })
    return response.data
  },
  createFullBackup: async (exportToDesktop = false) => {
    const response = await api.post('/backup/create', null, {
      params: { exportToDesktop, uploadToGoogleDrive: false, sendEmail: false }
    })
    return response.data
  },
  getBackups: async () => {
    const response = await api.get('/backup/list')  // FIXED: Use backup endpoint not admin
    return response.data
  },
  restoreBackup: async (fileName, uploadedFilePath = null) => {
    const response = await api.post('/backup/restore', {
      fileName,
      uploadedFilePath
    })
    return response.data
  },
  restoreBackupFromFile: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/backup/restore-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },
  deleteBackup: async (fileName) => {
    const response = await api.delete(`/backup/${encodeURIComponent(fileName)}`)
    return response.data
  },
  downloadBackup: async (fileName) => {
    const response = await api.get(`/backup/download/${encodeURIComponent(fileName)}`, {
      responseType: 'blob'
    })
    return response.data
  }
}

// Seed demo data (100 customers, 20 products, 50 sales) - for testing
export const seedAPI = {
  seedDemo: async () => {
    const response = await api.post('/seed/demo')
    return response.data
  }
}

// Subscription API
export const subscriptionAPI = {
  getPlans: async () => {
    const response = await api.get('/subscription/plans')
    return response.data
  },

  getPlan: async (id) => {
    const response = await api.get(`/subscription/plans/${id}`)
    return response.data
  },

  getCurrentSubscription: async () => {
    const response = await api.get('/subscription/current')
    return response.data
  },

  createSubscription: async (planId, billingCycle = 'Monthly') => {
    const response = await api.post('/subscription', {
      planId,
      billingCycle
    })
    return response.data
  },

  updateSubscription: async (id, planId, billingCycle) => {
    const response = await api.put(`/subscription/${id}`, {
      planId,
      billingCycle
    })
    return response.data
  },

  cancelSubscription: async (id, reason) => {
    const response = await api.post(`/subscription/${id}/cancel`, { reason })
    return response.data
  },

  renewSubscription: async (id) => {
    const response = await api.post(`/subscription/${id}/renew`)
    return response.data
  },

  getLimits: async () => {
    const response = await api.get('/subscription/limits')
    return response.data
  },

  checkFeature: async (feature) => {
    const response = await api.get(`/subscription/features/${feature}`)
    return response.data
  },

  getMetrics: async () => {
    const response = await api.get('/subscription/metrics')
    return response.data
  }
}

// Reset API
export const resetAPI = {
  getSystemSummary: async () => {
    const response = await api.get('/reset/summary')
    return response.data
  },
  getOwnerSummary: async () => {
    const response = await api.get('/reset/owner-summary')
    return response.data
  },
  executeReset: async (createBackup, clearAuditLogs, confirmationText) => {
    const response = await api.post('/reset/execute', {
      createBackup,
      clearAuditLogs,
      confirmationText
    })
    return response.data
  },
  resetOwnerData: async (confirmationText) => {
    const response = await api.post('/reset/owner-reset', {
      confirmationText
    })
    return response.data
  }
}

// Super Admin Tenant Management API
export const superAdminAPI = {
  getPlatformDashboard: async () => {
    const response = await api.get('/superadmin/tenant/dashboard')
    return response.data
  },

  getTenants: async (params = {}) => {
    const response = await api.get('/superadmin/tenant', { params })
    return response.data
  },

  getTenant: async (id) => {
    const response = await api.get(`/superadmin/tenant/${id}`)
    return response.data
  },

  createTenant: async (tenantData) => {
    const response = await api.post('/superadmin/tenant', tenantData)
    return response.data
  },

  updateTenant: async (id, tenantData) => {
    const response = await api.put(`/superadmin/tenant/${id}`, tenantData)
    return response.data
  },

  suspendTenant: async (id, reason) => {
    const response = await api.put(`/superadmin/tenant/${id}/suspend`, { reason })
    return response.data
  },

  activateTenant: async (id) => {
    const response = await api.put(`/superadmin/tenant/${id}/activate`)
    return response.data
  },

  clearTenantData: async (id) => {
    const response = await api.post(`/superadmin/tenant/${id}/clear-data`)
    return response.data
  },

  updateTenantSubscription: async (id, data) => {
    const response = await api.put(`/superadmin/tenant/${id}/subscription`, data)
    return response.data
  },

  getSubscriptionPlans: async () => {
    const response = await api.get('/subscription/plans')
    return response.data
  },

  getTenantUsage: async (id) => {
    const response = await api.get(`/superadmin/tenant/${id}/usage`)
    return response.data
  },

  deleteTenant: async (id) => {
    const response = await api.delete(`/superadmin/tenant/${id}`)
    return response.data
  },

  addTenantUser: async (tenantId, userData) => {
    const response = await api.post(`/superadmin/tenant/${tenantId}/users`, userData)
    return response.data
  },

  updateTenantUser: async (tenantId, userId, userData) => {
    const response = await api.put(`/superadmin/tenant/${tenantId}/users/${userId}`, userData)
    return response.data
  },

  deleteTenantUser: async (tenantId, userId) => {
    const response = await api.delete(`/superadmin/tenant/${tenantId}/users/${userId}`)
    return response.data
  },

  resetTenantUserPassword: async (tenantId, userId, passwordData) => {
    const response = await api.put(`/superadmin/tenant/${tenantId}/users/${userId}/reset-password`, passwordData)
    return response.data
  },

  duplicateDataToTenant: async (targetTenantId, sourceTenantId, dataTypes) => {
    const response = await api.post(`/superadmin/tenant/${targetTenantId}/duplicate-data`, { sourceTenantId, dataTypes })
    return response.data
  },

  getPlatformHealth: async () => {
    const response = await api.get('/superadmin/platform-health')
    return response.data
  },

  getErrorLogs: async (limit = 100) => {
    const response = await api.get('/error-logs', { params: { limit } })
    return response.data
  },

  getAuditLogs: async (page = 1, pageSize = 20, filters = {}) => {
    const params = { page, pageSize, ...filters }
    if (filters.fromDate) params.fromDate = filters.fromDate instanceof Date ? filters.fromDate.toISOString() : filters.fromDate
    if (filters.toDate) params.toDate = filters.toDate instanceof Date ? filters.toDate.toISOString() : filters.toDate
    const response = await api.get('/superadmin/audit-logs', { params })
    return response.data
  },

  applyMigrations: async () => {
    const response = await api.post('/migrate')
    return response.data
  }
}

// Branches and Routes API (branch/route architecture)
export const branchesAPI = {
  getBranches: async () => {
    const response = await api.get('/branches')
    return response.data
  },
  getBranch: async (id) => {
    const response = await api.get(`/branches/${id}`)
    return response.data
  },
  getBranchSummary: async (id, fromDate = null, toDate = null) => {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get(`/branches/${id}/summary`, { params })
    return response.data
  },
  createBranch: async (data) => {
    const response = await api.post('/branches', data)
    return response.data
  },
  updateBranch: async (id, data) => {
    const response = await api.put(`/branches/${id}`, data)
    return response.data
  },
  deleteBranch: async (id) => {
    const response = await api.delete(`/branches/${id}`)
    return response.data
  },
}

export const routesAPI = {
  getRoutes: async (branchId = null) => {
    const params = branchId != null ? { branchId } : {}
    const response = await api.get('/routes', { params })
    return response.data
  },
  getRoute: async (id) => {
    const response = await api.get(`/routes/${id}`)
    return response.data
  },
  getRouteSummary: async (id, fromDate = null, toDate = null) => {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get(`/routes/${id}/summary`, { params })
    return response.data
  },
  createRoute: async (data) => {
    const response = await api.post('/routes', data)
    return response.data
  },
  updateRoute: async (id, data) => {
    const response = await api.put(`/routes/${id}`, data)
    return response.data
  },
  deleteRoute: async (id) => {
    const response = await api.delete(`/routes/${id}`)
    return response.data
  },
  assignCustomer: async (routeId, customerId) => {
    const response = await api.post(`/routes/${routeId}/customers/${customerId}`)
    return response.data
  },
  unassignCustomer: async (routeId, customerId) => {
    const response = await api.delete(`/routes/${routeId}/customers/${customerId}`)
    return response.data
  },
  assignStaff: async (routeId, userId) => {
    const response = await api.post(`/routes/${routeId}/staff/${userId}`)
    return response.data
  },
  unassignStaff: async (routeId, userId) => {
    const response = await api.delete(`/routes/${routeId}/staff/${userId}`)
    return response.data
  },
  getRouteExpenses: async (routeId, fromDate = null, toDate = null) => {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    const response = await api.get(`/routes/${routeId}/expenses`, { params })
    return response.data
  },
  createRouteExpense: async (routeId, data) => {
    const response = await api.post(`/routes/${routeId}/expenses`, data)
    return response.data
  },
  deleteRouteExpense: async (routeId, expenseId) => {
    const response = await api.delete(`/routes/${routeId}/expenses/${expenseId}`)
    return response.data
  },
}

// Demo Request API (public + SuperAdmin)
export const demoRequestAPI = {
  create: async (data) => {
    const response = await api.post('/demorequest', data)
    return response.data
  },

  getAll: async (params = {}) => {
    const response = await api.get('/demorequest', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/demorequest/${id}`)
    return response.data
  },

  approve: async (id, planId, trialDays) => {
    const response = await api.post(`/demorequest/${id}/approve`, { planId, trialDays })
    return response.data
  },

  reject: async (id, reason) => {
    const response = await api.post(`/demorequest/${id}/reject`, { reason })
    return response.data
  },

  convertToTenant: async (id) => {
    const response = await api.post(`/demorequest/${id}/convert`)
    return response.data
  }
}
