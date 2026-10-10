const success = data => ({ success: true, data: { data } })

export const reportsAPI = {
  getVatReturn: async () => {
    if (window.__vatHarnessMode === 'loading') return new Promise(() => {})
    if (window.__vatHarnessMode === 'error') {
      throw { response: { status: 503, data: { message: 'Synthetic report service unavailable.' }, headers: { 'x-correlation-id': 'visual-test-0001' }, config: { url: '/api/Reports/vat-return' } } }
    }
    return success(window.__vatHarnessDto)
  },
  getComprehensiveSalesLedger: async () => ({ data: { summary: { totalSales: 1000, totalSalesVat: 0 } } }),
  getVatReturnPeriods: async () => ({ success: true, data: [] }),
  getVatReturnSuggestPeriod: async () => ({ success: true, data: null }),
  trackVatEvent: async () => ({ success: true }),
  calculateVatReturn: async () => {
    if (window.__vatHarnessMode === 'action-error') {
      throw { response: { status: 503, data: { message: 'Synthetic calculation service unavailable.' }, headers: { 'x-correlation-id': 'visual-action-0002' } } }
    }
    return success(window.__vatHarnessDto)
  },
  backfillVatScenario: async () => ({ success: true }),
  lockVatReturnPeriod: async () => ({ success: true }),
  submitVatReturnPeriod: async () => ({ success: true }),
  exportVatReturnExcel: async () => new Blob(),
  exportVatReturnCsv: async () => new Blob(),
  exportVatManagementPdf: async () => new Blob(),
  exportVatManagementExcel: async () => new Blob(),
  exportVatManagementCsv: async () => new Blob()
}
