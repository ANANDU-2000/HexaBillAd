import test from 'node:test'
import assert from 'node:assert/strict'
import { shellModeFor, SUGGESTIONS, CHIPS, greetingFor, openKey, readOpen, writeOpen, agentState, askAboutPrompt, threadTitle } from '../src/features/assistant/assistantUi.js'
import { describeChatReply, normalizeSources } from '../src/features/assistant/assistantChat.js'
import { parseSse, applyStreamEvent, emptyDraft, streamEnabled } from '../src/features/assistant/chatStreamCore.js'
import { voiceTransportKind, parseDataMessage, applyTranscript, createMockVoiceAdapter, hasVoiceConsent, saveVoiceConsent } from '../src/features/assistant/voiceSession.js'

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }

test('shell mode: phone under 700, sheet 700-1023, drawer from 1024', () => {
  assert.equal(shellModeFor(360), 'phone')
  assert.equal(shellModeFor(699), 'phone')
  assert.equal(shellModeFor(700), 'sheet')
  assert.equal(shellModeFor(752), 'sheet')
  assert.equal(shellModeFor(1023), 'sheet')
  assert.equal(shellModeFor(1024), 'drawer')
  assert.equal(shellModeFor(1440), 'drawer')
  assert.equal(shellModeFor(undefined), 'drawer')
})

test('suggestions: four cards, no emoji anywhere', () => {
  assert.equal(SUGGESTIONS.length, 4)
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
  for (const item of [...SUGGESTIONS.flatMap((s) => [s.title, s.hint, s.prompt]), ...CHIPS.flatMap((c) => [c.label, c.prompt])]) assert.doesNotMatch(item, emoji)
})

test('greeting uses the first name and the time of day', () => {
  assert.equal(greetingFor('Anand Kumar', new Date(2026, 10, 8, 9)), 'Good morning, Anand')
  assert.equal(greetingFor('', new Date(2026, 10, 8, 15)), 'Good afternoon')
  assert.equal(greetingFor('Sara', new Date(2026, 10, 8, 20)), 'Good evening, Sara')
})

test('open state is stored per tenant under a prefixed key', () => {
  const s = memory()
  assert.equal(openKey(7), 'hexabill.assistant.open.7')
  writeOpen(7, true, s)
  assert.equal(readOpen(7, s), true)
  assert.equal(readOpen(8, s), false)
  writeOpen(7, false, s)
  assert.equal(readOpen(7, s), false)
  assert.equal(readOpen(1, { getItem () { throw new Error('blocked') } }), false)
})

test('agent state', () => {
  assert.equal(agentState({}), 'idle')
  assert.equal(agentState({ sending: true }), 'thinking')
  assert.equal(agentState({ sending: true, error: true }), 'error')
  assert.equal(agentState({ voice: 'listening' }), 'listening')
})

test('ask-about prompt names the record and never an amount', () => {
  assert.equal(askAboutPrompt({ kind: 'invoice', label: 'INV-1042' }), 'Tell me about invoice INV-1042')
  assert.equal(askAboutPrompt({ kind: 'customer' }), 'Tell me about this customer')
  assert.equal(threadTitle('x'.repeat(60)).length, 40)
})

test('D-A02: reply text shows only when the server says grounded === true', () => {
  const text = 'You have 3 overdue invoices.'
  const off = describeChatReply({ mode: 'reply', text })
  assert.doesNotMatch(off.text, /3 overdue/)
  assert.match(off.text, /look up customers/)
  for (const grounded of [false, 'true', 1, null, undefined]) assert.doesNotMatch(describeChatReply({ mode: 'reply', text, grounded }).text, /3 overdue/)
  assert.match(describeChatReply({ mode: 'reply', text: '   ', grounded: true }).text, /look up customers/)
  const on = describeChatReply({ mode: 'reply', text, grounded: true, asOf: '2026-11-08T10:00:00Z', sources: ['Sales ledger', { label: 'Customer 12', href: '/customers/12' }, { label: 'Bad', href: 'javascript:alert(1)' }, { label: 'Protocol relative', href: '//evil.com' }] })
  assert.equal(on.kind, 'reply')
  assert.equal(on.grounded, true)
  assert.equal(on.text, text)
  assert.equal(on.asOf, '2026-11-08T10:00:00Z')
  assert.deepEqual(on.sources.map((s) => s.href), [null, '/customers/12', null, null])
  assert.deepEqual(normalizeSources('nope'), [])
  assert.equal(normalizeSources(Array.from({ length: 9 }, (_, i) => `s${i}`)).length, 5)
})

test('SSE parser keeps the unfinished tail and ignores malformed events', () => {
  const a = parseSse('data: {"type":"token","text":"Hel"}\n\ndata: {"type":"tok')
  assert.equal(a.events.length, 1)
  assert.equal(a.rest, 'data: {"type":"tok')
  const b = parseSse(`${a.rest}en","text":"lo"}\r\n\r\ndata: not json\n\ndata: {"type":"done","reply":{"mode":"reply"}}\n\n`)
  assert.deepEqual(b.events.map((e) => e.type), ['token', 'done'])
})

test('stream draft: tokens stay hidden unless grounded; tools and cards accumulate; done carries the reply', () => {
  let d = emptyDraft()
  d = applyStreamEvent(d, { type: 'token', text: 'secret model text' })
  assert.equal(d.text, '')
  d = applyStreamEvent(d, { type: 'token', text: 'Grounded ', grounded: true })
  d = applyStreamEvent(d, { type: 'token', text: 'answer', grounded: true })
  assert.equal(d.text, 'Grounded answer')
  d = applyStreamEvent(d, { type: 'tool', name: 'find_customers', status: 'running' })
  d = applyStreamEvent(d, { type: 'tool', name: 'find_customers', status: 'done' })
  assert.deepEqual(d.tools, [{ name: 'find_customers', status: 'done' }])
  d = applyStreamEvent(d, { type: 'card', card: { kind: 'new_expense', fields: {} } })
  assert.equal(d.cards.length, 1)
  d = applyStreamEvent(d, { type: 'unknown' })
  d = applyStreamEvent(d, { type: 'done', reply: { mode: 'reply' } })
  assert.equal(d.done, true)
  assert.equal(d.reply.mode, 'reply')
})

test('stream is off unless the build flag or the browser switch says 1', () => {
  assert.equal(streamEnabled({}, memory()), false)
  assert.equal(streamEnabled({ VITE_ASSISTANT_STREAM: '1' }, memory()), true)
  const s = memory()
  s.setItem('hexabill.assistant.stream', '1')
  assert.equal(streamEnabled({}, s), true)
})

test('voice transport: push-to-talk by default, livekit by flag, mock only in dev with the browser switch', () => {
  const s = memory()
  assert.equal(voiceTransportKind({}, s), 'push-to-talk')
  assert.equal(voiceTransportKind({ VITE_ASSISTANT_VOICE: 'livekit' }, s), 'livekit')
  s.setItem('hexabill.assistant.voice', 'mock')
  assert.equal(voiceTransportKind({ VITE_ASSISTANT_VOICE: 'livekit' }, s), 'livekit')
  assert.equal(voiceTransportKind({ DEV: true }, s), 'mock')
})

test('voice data messages: valid ones pass, anything else is dropped', () => {
  assert.deepEqual(parseDataMessage('{"type":"state","state":"speaking"}'), { type: 'state', state: 'speaking' })
  assert.equal(parseDataMessage('{"type":"state","state":"hacked"}'), null)
  assert.equal(parseDataMessage('nope'), null)
  assert.equal(parseDataMessage({ type: 'transcript', role: 'system', text: 'x' }), null)
  assert.deepEqual(parseDataMessage({ type: 'transcript', role: 'agent', text: 'hi' }), { type: 'transcript', role: 'agent', text: 'hi', final: true })
  assert.equal(parseDataMessage({ type: 'card' }), null)
  let lines = applyTranscript([], { role: 'user', text: 'Rec', final: false })
  lines = applyTranscript(lines, { role: 'user', text: 'Received', final: true })
  lines = applyTranscript(lines, { role: 'agent', text: 'OK', final: true })
  assert.deepEqual(lines.map((l) => l.text), ['Received', 'OK'])
})

test('mock voice adapter plays its script, honours mute, and can fail to connect', async () => {
  const seen = []
  const a = createMockVoiceAdapter({ steps: [{ at: 1, event: 'state', payload: 'listening' }, { at: 2, event: 'transcript', payload: { role: 'user', text: 'hi', final: true } }, { at: 3, event: 'transcript', payload: { role: 'agent', text: 'hello', final: true } }] })
  a.on('state', (s) => seen.push(`s:${s}`))
  a.on('transcript', (t) => seen.push(`t:${t.role}`))
  a.setMuted(true)
  await a.connect()
  await new Promise((r) => setTimeout(r, 40))
  a.disconnect()
  assert.deepEqual(seen, ['s:connecting', 's:listening', 't:agent', 's:ended'])
  await assert.rejects(createMockVoiceAdapter({ failConnect: true }).connect(), /not available/)
})

test('voice consent is remembered per tenant', () => {
  const s = memory()
  assert.equal(hasVoiceConsent(3, s), false)
  saveVoiceConsent(3, s)
  assert.equal(hasVoiceConsent(3, s), true)
  assert.equal(hasVoiceConsent(4, s), false)
})
