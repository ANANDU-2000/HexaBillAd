import { useSyncExternalStore } from 'react'
import { threadTitle } from './assistantUi'

// In-memory conversation store shared by the drawer and the /assistant page, so Expand keeps the thread.
// Deliberately NOT persisted: answers can contain customer and money data, and the tenant key resets it on switch/sign-out.
let state = {
  tenantKey: null,
  threads: [], // { id, title, messages: [], updatedAt }
  activeId: null,
  sending: false,
  prefill: null, // text for the composer, consumed once
  openRequested: false, // opened from outside (Ctrl+J, "Ask agent about this")
  closeNonce: 0,
  panelOpen: false,
}
const listeners = new Set()
const emit = () => { listeners.forEach((l) => l()) }
const set = (patch) => { state = { ...state, ...patch }; emit() }
let counter = 0
const nextId = (p) => `${p}-${Date.now().toString(36)}-${++counter}`

export const assistantStore = {
  getState: () => state,
  subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },

  /** Call when the signed-in tenant/user changes: conversations never cross tenants. */
  bindTenant (tenantKey) {
    if (state.tenantKey === tenantKey) return
    state = { ...state, tenantKey, threads: [], activeId: null, sending: false, prefill: null }
    emit()
  },

  newThread () {
    const existing = state.threads.find((t) => t.messages.length === 0)
    if (existing) { set({ activeId: existing.id }); return existing.id }
    const thread = { id: nextId('thread'), title: 'New chat', messages: [], updatedAt: Date.now() }
    set({ threads: [thread, ...state.threads], activeId: thread.id })
    return thread.id
  },
  selectThread: (id) => set({ activeId: id }),
  activeThread () {
    return state.threads.find((t) => t.id === state.activeId) || null
  },

  addMessage (threadId, message) {
    const msg = { id: nextId(message.sender || 'm'), timestamp: new Date(), ...message }
    set({
      threads: state.threads.map((t) => {
        if (t.id !== threadId) return t
        const title = t.messages.length === 0 && msg.sender === 'user' ? threadTitle(msg.text) : t.title
        return { ...t, title, messages: [...t.messages, msg], updatedAt: Date.now() }
      }),
    })
    return msg.id
  },
  patchMessage (threadId, messageId, patch) {
    set({ threads: state.threads.map((t) => (t.id !== threadId ? t : { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) })) })
  },
  setSending: (sending) => set({ sending }),

  setPrefill: (prefill) => set({ prefill }),
  consumePrefill () {
    const p = state.prefill
    if (p != null) set({ prefill: null })
    return p
  },

  // Outside entry points. The panel mirrors its real open state through setPanelOpen so toggle knows what to do.
  requestOpen ({ prefill } = {}) { set({ openRequested: true, ...(prefill != null ? { prefill } : {}) }) },
  requestToggle () {
    if (state.panelOpen) set({ closeNonce: state.closeNonce + 1, openRequested: false })
    else set({ openRequested: true })
  },
  clearOpenRequest: () => { if (state.openRequested) set({ openRequested: false }) },
  setPanelOpen: (panelOpen) => { if (state.panelOpen !== panelOpen) set({ panelOpen }) },
}

export function useAssistantStore () {
  return useSyncExternalStore(assistantStore.subscribe, assistantStore.getState, assistantStore.getState)
}

/** Open the assistant from anywhere (e.g. "Ask agent about this" on a ledger row). */
export const openAssistant = (opts) => assistantStore.requestOpen(opts)
