// Turns the chat endpoint's answer into what the panel shows. Pure; no React, no network.

export const CHAT_MAX_CHARS = 500
export const CHAT_MIN_CHARS = 2

/** A reason the message cannot be sent, or null. */
export function chatMessageProblem (message) {
  const length = (message || '').trim().length
  if (length < CHAT_MIN_CHARS) return `Type at least ${CHAT_MIN_CHARS} characters.`
  if (length > CHAT_MAX_CHARS) return `Keep it under ${CHAT_MAX_CHARS} characters.`
  return null
}

const TOOL_NAMES = { find_customers: 'customers', product_stock: 'products' }

/**
 * data: the `data` of POST /assistant/chat ({ mode, tool, query, result, text, provider }).
 * kind: tool (rows from the books), reply (model text, labelled), unavailable / refused (a plain explanation).
 */
export function describeChatReply (data) {
  const mode = data?.mode
  if (mode === 'tool' && data.result) {
    const what = TOOL_NAMES[data.tool] || 'records'
    return {
      kind: 'tool',
      tool: data.tool,
      heading: `I looked up ${what} for “${data.query}”.`,
      rows: Array.isArray(data.result.data) ? data.result.data : [],
      asOf: data.result.asOf,
      text: null,
      note: null,
    }
  }
  if (mode === 'reply') {
    return { kind: 'reply', tool: null, heading: 'Assistant suggestion', rows: [], text: data.text || '', note: 'This text is not checked against your records. Use the Look up tab for facts.' }
  }
  if (mode === 'refused') {
    return { kind: 'refused', tool: null, heading: null, rows: [], text: data.text || 'The assistant cannot answer this right now.', note: 'You can still use the Look up tab.' }
  }
  return { kind: 'unavailable', tool: null, heading: null, rows: [], text: data?.text || 'The assistant is not available right now.', note: 'You can still use the Look up tab.' }
}
