// UX-E03: streaming chat adapter. NEEDS-BACKEND: POST /assistant/chat/stream (text/event-stream).
// Events (SSE `data:` JSON): {type:"token",text,grounded?:true} | {type:"tool",name,status} | {type:"card",card} | {type:"done",reply}.
// `reply` has the same shape as the `data` of POST /assistant/chat today, so describeChatReply() renders the final answer.
// Off by default; until the endpoint exists the panel uses the single-response call. Pure helpers here, transport at the bottom.

export const STREAM_FLAG_KEY = 'hexabill.assistant.stream'

export function streamEnabled (env = import.meta.env, storage = globalThis.localStorage) {
  if (String(env?.VITE_ASSISTANT_STREAM || '') === '1') return true
  try { return storage?.getItem(STREAM_FLAG_KEY) === '1' } catch { return false }
}

/** Splits an SSE buffer into complete events. `rest` is the unfinished tail to prepend to the next chunk. */
export function parseSse (buffer) {
  const events = []
  const blocks = String(buffer || '').replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  for (const block of blocks) {
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n')
    if (!data) continue
    try { events.push(JSON.parse(data)) } catch { /* ignore a malformed event instead of breaking the stream */ }
  }
  return { events, rest }
}

export const emptyDraft = () => ({ text: '', tools: [], cards: [], reply: null, done: false })

/** Folds one event into the draft shown while the answer is being produced. */
export function applyStreamEvent (draft, event) {
  switch (event?.type) {
    // D-A02: model text stays hidden unless the server marks the token grounded. The final answer always goes through describeChatReply.
    case 'token': return event.grounded === true ? { ...draft, text: draft.text + String(event.text ?? '') } : draft
    case 'tool': {
      const name = String(event.name || '')
      if (!name) return draft
      const others = draft.tools.filter((t) => t.name !== name)
      return { ...draft, tools: [...others, { name, status: event.status || 'running' }] }
    }
    case 'card': return event.card ? { ...draft, cards: [...draft.cards, event.card] } : draft
    case 'done': return { ...draft, reply: event.reply || null, done: true }
    default: return draft
  }
}
