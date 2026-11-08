// Pure helpers for the assistant shell (no React, no network): layout mode, suggestions, persistence keys, state names.

export const PHONE_MAX = 700 // below this: full screen
export const SHEET_MAX = 1024 // below this: bottom sheet; at or above: right drawer
export const DRAWER_WIDTH = 420

/** phone (<700), sheet (700-1023), drawer (>=1024). */
export function shellModeFor (width) {
  const w = Number(width)
  if (!Number.isFinite(w) || w >= SHEET_MAX) return 'drawer'
  return w < PHONE_MAX ? 'phone' : 'sheet'
}

/** Icon ids resolve in AssistantThread (components/ui/icons.js); keep this file free of React. */
export const SUGGESTIONS = [
  { id: 'summary', icon: 'chart', title: "Today's summary", hint: 'Sales, received, expenses and what is owed', prompt: "Show today's business summary" },
  { id: 'overdue', icon: 'alert', title: 'Overdue customers', hint: 'Who is late on your routes', prompt: 'Which customers are overdue on routes?' },
  { id: 'stock', icon: 'package', title: 'Low stock', hint: 'Products that need re-ordering', prompt: 'Show low stock products' },
  { id: 'payment', icon: 'wallet', title: 'Record a payment', hint: 'Prepares a receipt for you to check', prompt: 'Record payment received' },
]

export const CHIPS = [
  { id: 'summary', icon: 'chart', label: 'Summary', prompt: "Show today's business summary" },
  { id: 'overdue', icon: 'alert', label: 'Overdue', prompt: 'Which customers are overdue on routes?' },
  { id: 'stock', icon: 'package', label: 'Low stock', prompt: 'Show low stock products' },
  { id: 'payment', icon: 'wallet', label: 'Payment', prompt: 'Record payment received' },
  { id: 'invoice', icon: 'receipt', label: 'Invoice', prompt: 'Create new sale invoice' },
  { id: 'expense', icon: 'card', label: 'Expense', prompt: 'Record expense' },
  { id: 'customer', icon: 'user', label: 'Customer', prompt: 'Add new customer' },
]

export function greetingFor (name, date = new Date()) {
  const hour = date.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = String(name || '').trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

const OPEN_PREFIX = 'hexabill.assistant.open.'
export const openKey = (tenantId) => `${OPEN_PREFIX}${tenantId ?? 'none'}`

export function readOpen (tenantId, storage = globalThis.localStorage) {
  try { return storage?.getItem(openKey(tenantId)) === '1' } catch { return false }
}

export function writeOpen (tenantId, open, storage = globalThis.localStorage) {
  try { storage?.setItem(openKey(tenantId), open ? '1' : '0') } catch { /* storage blocked: the choice lasts until the page closes */ }
}

/** idle | thinking | error | listening | speaking (listening/speaking come from voice mode). */
export function agentState ({ sending = false, error = false, voice = null } = {}) {
  if (error) return 'error'
  if (voice === 'listening' || voice === 'speaking' || voice === 'thinking') return voice
  return sending ? 'thinking' : 'idle'
}

export const STATE_LABEL = {
  idle: 'Ready',
  thinking: 'Thinking',
  error: 'Something went wrong',
  listening: 'Listening',
  speaking: 'Speaking',
}

/** Starter text for "Ask agent about this": a reference the person can finish. Never includes amounts. */
export function askAboutPrompt (ref) {
  const kind = String(ref?.kind || 'record').trim()
  const label = String(ref?.label || ref?.id || '').trim()
  return label ? `Tell me about ${kind} ${label}` : `Tell me about this ${kind}`
}

export function threadTitle (text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  return t.length > 40 ? `${t.slice(0, 37)}...` : t || 'New chat'
}
