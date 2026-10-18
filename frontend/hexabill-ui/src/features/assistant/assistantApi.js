import api from '../../services/api'

// Thin client for /api/assistant. Every call returns { ok, status, message, data } so the panel can tell
// a refusal (4xx, nothing happened) from a failure whose outcome is uncertain (5xx or no response).
const wrap = async (call) => {
  try {
    const res = await call()
    return { ok: true, status: res.status, message: res.data?.message || '', data: res.data?.data }
  } catch (error) {
    const status = error?.response?.status
    return { ok: false, status, message: error?.response?.data?.message || '', data: error?.response?.data?.data }
  }
}

export const assistantApi = {
  status: () => wrap(() => api.get('/assistant/status')),
  chat: (message) => wrap(() => api.post('/assistant/chat', { message })),
  runTool: (name, args) => wrap(() => api.post(`/assistant/tools/${name}`, args)),
  createCustomerDraft: (body) => wrap(() => api.post('/assistant/drafts/customer', body)),
  createExpenseDraft: (body) => wrap(() => api.post('/assistant/drafts/expense', body)),
  listExpenseCategories: () => wrap(() => api.get('/expenses/categories')),
  confirmDraft: (id, payloadHash, idempotencyKey) =>
    wrap(() => api.post(`/assistant/drafts/${id}/confirm`, { payloadHash, idempotencyKey })),
  cancelDraft: (id) => wrap(() => api.post(`/assistant/drafts/${id}/cancel`)),
}
