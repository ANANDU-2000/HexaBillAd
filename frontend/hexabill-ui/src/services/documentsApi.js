import api from './api'

export const quotationsAPI = {
  list: async () => {
    const response = await api.get('/quotations', { _bypassCache: true })
    return response.data
  },
  get: async (id) => {
    const response = await api.get(`/quotations/${id}`, { _bypassCache: true })
    return response.data
  },
  nextNumber: async () => {
    const response = await api.get('/quotations/next-number')
    return response.data
  },
  create: async (payload) => {
    const response = await api.post('/quotations', payload)
    return response.data
  },
  update: async (id, payload) => {
    const response = await api.put(`/quotations/${id}`, payload)
    return response.data
  },
  remove: async (id) => {
    const response = await api.delete(`/quotations/${id}`)
    return response.data
  },
  /** Alias — list pages call .delete */
  delete: async (id) => {
    const response = await api.delete(`/quotations/${id}`)
    return response.data
  },
  getPdf: async (id, format = 'A4') => {
    const response = await api.get(`/quotations/${id}/pdf`, {
      params: { format },
      responseType: 'blob',
      _bypassCache: true,
    })
    return response.data
  },
}

export const agreementsAPI = {
  list: async () => {
    const response = await api.get('/agreements', { _bypassCache: true })
    return response.data
  },
  get: async (id) => {
    const response = await api.get(`/agreements/${id}`, { _bypassCache: true })
    return response.data
  },
  previewBlank: async () => {
    const response = await api.get('/agreements/preview-blank')
    return response.data
  },
  create: async (payload) => {
    const response = await api.post('/agreements', payload)
    return response.data
  },
  update: async (id, payload) => {
    const response = await api.put(`/agreements/${id}`, payload)
    return response.data
  },
  remove: async (id) => {
    const response = await api.delete(`/agreements/${id}`)
    return response.data
  },
  /** Alias — list pages call .delete */
  delete: async (id) => {
    const response = await api.delete(`/agreements/${id}`)
    return response.data
  },
  getPdf: async (id, format = 'A4', layout = 'full') => {
    const response = await api.get(`/agreements/${id}/pdf`, {
      params: { format, layout },
      responseType: 'blob',
      _bypassCache: true,
    })
    return response.data
  },
}

export const salaryCertificatesAPI = {
  list: async () => {
    const response = await api.get('/salary-certificates', { _bypassCache: true })
    return response.data
  },
  get: async (id) => {
    const response = await api.get(`/salary-certificates/${id}`, { _bypassCache: true })
    return response.data
  },
  previewBlank: async () => {
    const response = await api.get('/salary-certificates/preview-blank')
    return response.data
  },
  create: async (payload) => {
    const response = await api.post('/salary-certificates', payload)
    return response.data
  },
  update: async (id, payload) => {
    const response = await api.put(`/salary-certificates/${id}`, payload)
    return response.data
  },
  remove: async (id) => {
    const response = await api.delete(`/salary-certificates/${id}`)
    return response.data
  },
  /** Alias — list pages call .delete */
  delete: async (id) => {
    const response = await api.delete(`/salary-certificates/${id}`)
    return response.data
  },
  getPdf: async (id, format = 'A4', layout = 'full') => {
    const response = await api.get(`/salary-certificates/${id}/pdf`, {
      params: { format, layout },
      responseType: 'blob',
      _bypassCache: true,
    })
    return response.data
  },
}
