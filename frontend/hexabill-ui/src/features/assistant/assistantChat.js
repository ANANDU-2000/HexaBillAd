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

const TOOL_NAMES = { find_customers: 'customers', product_stock: 'products', search_company_documents: 'your documents' }

const FORM_LABELS = {
  new_customer: { title: 'a new customer', fields: { name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', trn: 'TRN' } },
  new_expense: { title: 'a new expense', fields: { categoryName: 'Category', amount: 'Amount', date: 'Date', note: 'Note' } },
}

/** Rows to show for a suggested form: what the assistant filled in, in the form's own order. */
export function suggestionRows (kind, fields) {
  const labels = FORM_LABELS[kind]?.fields || {}
  return Object.keys(labels).filter((key) => fields?.[key]).map((key) => ({ key, label: labels[key], value: fields[key] }))
}

const lower = (value) => String(value || '').trim().toLowerCase()

/**
 * Suggested fields -> the values the normal form starts with. The category is matched by name against the company's own categories
 * (exact first, then a clear partial match); no match leaves it empty for the person to choose.
 */
export function prefillFor (kind, fields = {}, categories = []) {
  if (kind === 'new_customer') {
    return { name: fields.name || '', phone: fields.phone || '', email: fields.email || '', address: fields.address || '', trn: fields.trn || '' }
  }
  const wanted = lower(fields.categoryName)
  const list = Array.isArray(categories) ? categories : []
  const exact = wanted ? list.find((c) => lower(c.name) === wanted) : null
  const partial = !exact && wanted.length >= 3 ? list.filter((c) => lower(c.name).includes(wanted) || wanted.includes(lower(c.name))) : []
  const match = exact || (partial.length === 1 ? partial[0] : null)
  const out = {}
  if (fields.amount) out.amount = String(fields.amount)
  if (fields.date) out.date = fields.date
  if (fields.note) out.note = fields.note
  out.categoryId = match ? String(match.id) : ''
  return out
}

/**
 * data: the `data` of POST /assistant/chat ({ mode, tool, query, result, text, provider }).
 * kind: tool (rows from the books), reply (fixed guidance), unavailable / refused (a plain explanation).
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
  if (mode === 'suggestion' && data.suggestion) {
    const s = data.suggestion
    return {
      kind: 'suggestion',
      formKind: s.kind,
      fields: s.fields || {},
      dropped: s.dropped || [],
      rows: suggestionRows(s.kind, s.fields),
      heading: `I filled in ${FORM_LABELS[s.kind]?.title || 'a form'} for you.`,
      text: null,
      note: 'Nothing is saved. Check every field, then review and confirm it yourself.',
    }
  }
  if (mode === 'reply') {
    return { kind: 'reply', tool: null, heading: 'Assistant help', rows: [], text: 'I can look up customers and product stock, search your documents, or help fill in a new customer or expense. Try asking for one of those.', note: 'Use the Look up tab for records from your company.' }
  }
  if (mode === 'refused') {
    return { kind: 'refused', tool: null, heading: null, rows: [], text: data.text || 'The assistant cannot answer this right now.', note: 'You can still use the Look up tab.' }
  }
  return { kind: 'unavailable', tool: null, heading: null, rows: [], text: data?.text || 'The assistant is not available right now.', note: 'You can still use the Look up tab.' }
}
