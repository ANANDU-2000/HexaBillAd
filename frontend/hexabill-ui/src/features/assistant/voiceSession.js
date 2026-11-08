// UX-E05: live voice adapter. The UI talks only to this interface, so it is testable with the mock and the real
// transport (LiveKit) can be swapped in without touching the components.
//
// NEEDS-BACKEND  POST /assistant/voice/session -> { url, token, room, expiresAt, provider: "gemini-live" | "openrouter" }
//   scoped to tenant + user server-side; the browser never holds a provider key.
// Data messages on the LiveKit data channel (JSON):
//   {type:"state", state:"listening"|"thinking"|"speaking"}
//   {type:"transcript", role:"user"|"agent", text, final:boolean}
//   {type:"card", card}   (same payload the draft/ActionCard flow uses; the card still needs human Confirm)
// NEEDS-DEPENDENCY  livekit-client (see livekitLoader.js). Without it, or without the endpoint, push-to-talk is used.

export const VOICE_MODE_FLAG = 'livekit'
export const VOICE_CONSENT_PREFIX = 'hexabill.voice.consent.'

export const VOICE_MOCK_KEY = 'hexabill.assistant.voice'

/**
 * 'livekit' only when the build flag asks for it; 'mock' only in a dev build with localStorage hexabill.assistant.voice=mock
 * (scripted session for previews and tests, never in production); everything else is the existing push-to-talk.
 */
export function voiceTransportKind (env = import.meta.env, storage = globalThis.localStorage) {
  if (env?.DEV) {
    try { if (storage?.getItem(VOICE_MOCK_KEY) === 'mock') return 'mock' } catch { /* blocked storage */ }
  }
  return String(env?.VITE_ASSISTANT_VOICE || '').toLowerCase() === VOICE_MODE_FLAG ? 'livekit' : 'push-to-talk'
}

/** What the scripted mock session plays: every state, a transcript, and a payment card that still needs Confirm. */
export const DEMO_VOICE_STEPS = [
  { at: 400, event: 'state', payload: 'listening' },
  { at: 900, event: 'transcript', payload: { role: 'user', text: 'Received five hundred dirhams from', final: false } },
  { at: 1300, event: 'transcript', payload: { role: 'user', text: 'Received five hundred dirhams from Al Noor', final: true } },
  { at: 1500, event: 'state', payload: 'thinking' },
  { at: 2200, event: 'state', payload: 'speaking' },
  { at: 2300, event: 'transcript', payload: { role: 'agent', text: 'I prepared a payment of 500 AED from Al Noor. Please check it on screen.', final: true } },
  { at: 2400, event: 'card', payload: { kind: 'new_payment', fields: { customerName: 'Al Noor', amount: '500', mode: 'CASH' } } },
  { at: 4200, event: 'state', payload: 'listening' },
]

export const voiceConsentKey = (tenantKey) => `${VOICE_CONSENT_PREFIX}${tenantKey ?? 'none'}`
export function hasVoiceConsent (tenantKey, storage = globalThis.localStorage) {
  try { return storage?.getItem(voiceConsentKey(tenantKey)) === '1' } catch { return false }
}
export function saveVoiceConsent (tenantKey, storage = globalThis.localStorage) {
  try { storage?.setItem(voiceConsentKey(tenantKey), '1') } catch { /* blocked storage: asked again next time */ }
}

/** Validates one data-channel message. Unknown or malformed messages are dropped (the agent is untrusted input). */
export function parseDataMessage (raw) {
  let msg = raw
  if (typeof raw === 'string') { try { msg = JSON.parse(raw) } catch { return null } }
  if (!msg || typeof msg !== 'object') return null
  if (msg.type === 'state' && ['listening', 'thinking', 'speaking'].includes(msg.state)) return { type: 'state', state: msg.state }
  if (msg.type === 'transcript' && (msg.role === 'user' || msg.role === 'agent') && typeof msg.text === 'string') {
    return { type: 'transcript', role: msg.role, text: msg.text.slice(0, 1000), final: msg.final !== false }
  }
  if (msg.type === 'card' && msg.card && typeof msg.card === 'object') return { type: 'card', card: msg.card }
  return null
}

/** Merges a transcript message into the visible lines: an interim line of the same speaker is replaced until it is final. */
export function applyTranscript (lines, msg) {
  const last = lines[lines.length - 1]
  if (last && last.role === msg.role && !last.final) return [...lines.slice(0, -1), { role: msg.role, text: msg.text, final: msg.final }]
  return [...lines, { role: msg.role, text: msg.text, final: msg.final }]
}

/**
 * Adapter contract:
 *   connect() -> Promise<void>      (rejects with Error(message) when the session cannot start)
 *   disconnect() -> void
 *   setMuted(boolean) -> void
 *   on(event, cb) -> unsubscribe    events: 'state' (connecting|listening|thinking|speaking|ended), 'transcript' (msg), 'card' (card)
 *   provider -> string | null       from the session response, never hardcoded
 */
function emitter () {
  const handlers = {}
  return {
    on (event, cb) {
      if (!handlers[event]) handlers[event] = new Set()
      handlers[event].add(cb)
      return () => handlers[event].delete(cb)
    },
    emit (event, payload) { if (handlers[event]) handlers[event].forEach((cb) => cb(payload)) },
  }
}

/** Scripted adapter for tests and previews: steps = [{ at: ms, event, payload }]. No network, no microphone. */
export function createMockVoiceAdapter ({ steps = [], provider = 'mock-voice', failConnect = false, connectDelay = 0 } = {}) {
  const bus = emitter()
  let timers = []
  let muted = false
  return {
    provider,
    on: bus.on,
    async connect () {
      bus.emit('state', 'connecting')
      if (connectDelay) await new Promise((r) => setTimeout(r, connectDelay))
      if (failConnect) throw new Error('The voice service is not available.')
      timers = steps.map((s) => setTimeout(() => {
        if (muted && s.event === 'transcript' && s.payload?.role === 'user') return
        bus.emit(s.event, s.payload)
      }, s.at))
    },
    disconnect () { timers.forEach(clearTimeout); timers = []; bus.emit('state', 'ended') },
    setMuted (m) { muted = !!m },
  }
}

/** Real transport. `fetchSession` = assistantApi.voiceSession, `loadLivekit` = livekitLoader.loadLivekit. Not exercised in unit tests. */
export function createLivekitAdapter ({ fetchSession, loadLivekit }) {
  const bus = emitter()
  let room = null
  let audioEls = []
  const adapter = {
    provider: null,
    on: bus.on,
    async connect () {
      bus.emit('state', 'connecting')
      const res = await fetchSession()
      if (!res?.ok || !res.data?.token || !res.data?.url) throw new Error(res?.message || 'The voice service is not available.')
      adapter.provider = res.data.provider || null
      const lk = await loadLivekit()
      room = new lk.Room()
      room.on(lk.RoomEvent.DataReceived, (payload) => {
        let text = ''
        try { text = new TextDecoder().decode(payload) } catch { return }
        const msg = parseDataMessage(text)
        if (!msg) return
        if (msg.type === 'state') bus.emit('state', msg.state)
        else if (msg.type === 'transcript') bus.emit('transcript', msg)
        else bus.emit('card', msg.card)
      })
      room.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'audio') { const el = track.attach(); audioEls.push(el); document.body.appendChild(el) }
      })
      room.on(lk.RoomEvent.Disconnected, () => bus.emit('state', 'ended'))
      await room.connect(res.data.url, res.data.token)
      await room.localParticipant.setMicrophoneEnabled(true) // the browser asks for the microphone here, after our consent screen
      bus.emit('state', 'listening')
    },
    disconnect () {
      try { if (room) room.disconnect() } catch { /* already closed */ }
      audioEls.forEach((el) => el.remove())
      audioEls = []
      room = null
      bus.emit('state', 'ended')
    },
    setMuted (m) { try { if (room) room.localParticipant.setMicrophoneEnabled(!m) } catch { /* not connected */ } },
  }
  return adapter
}
