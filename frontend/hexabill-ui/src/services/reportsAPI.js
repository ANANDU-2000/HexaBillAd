import { axios } from 'axios'

export const reportsAPI = {
  getDashboardSummary: async () => {
    const response = await axios.get('/api/reports/summary')
    return response.data
  },

  getProductSales: async (params) => {
    const response = await axios.get('/api/reports/product-sales', { params })
    return response.data
  },

  getOutstandingPayments: async (params) => {
    const response = await axios.get('/api/reports/outstanding', { params })
    return response.data
  },

  getLowStock: async () => {
    const response = await axios.get('/api/products?lowStock=true')
    return response.data
  }
}