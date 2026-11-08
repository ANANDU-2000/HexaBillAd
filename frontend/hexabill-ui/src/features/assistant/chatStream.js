// UX-E03 transport for the streaming chat (contract and pure helpers: chatStreamCore.js).
import api from '../../services/api'
import { parseSse } from './chatStreamCore'

/**
 * Real transport. Uses the shared axios instance (auth + tenant headers) with progressive XHR text.
 * Resolves { ok:false, unsupported:true } when the endpoint is missing so the caller can fall back to the single response.
 */
export async function streamChat (message, { onEvent, signal } = {}) {
  let seen = 0
  let tail = ''
  const feed = (text) => {
    const { events, rest } = parseSse(tail + text.slice(seen))
    seen = text.length
    tail = rest
    events.forEach((e) => onEvent?.(e))
  }
  try {
    const res = await api.post('/assistant/chat/stream', { message }, {
      responseType: 'text',
      signal,
      headers: { Accept: 'text/event-stream' },
      onDownloadProgress: (e) => { const text = e?.event?.target?.responseText; if (typeof text === 'string') feed(text) },
    })
    if (typeof res.data === 'string') feed(res.data)
    if (tail.trim()) feed('\n\n')
    return { ok: true }
  } catch (error) {
    const status = error?.response?.status
    if (status === 404 || status === 405 || status === 501) return { ok: false, unsupported: true }
    if (error?.code === 'ERR_CANCELED') return { ok: false, canceled: true }
    return { ok: false, status, message: error?.response?.data?.message || '' }
  }
}
