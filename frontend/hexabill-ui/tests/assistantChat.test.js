import test from 'node:test'
import assert from 'node:assert/strict'
import { chatMessageProblem, describeChatReply, CHAT_MAX_CHARS } from '../src/features/assistant/assistantChat.js'

test('messages need a sensible length', () => {
  assert.match(chatMessageProblem(''), /at least 2/)
  assert.match(chatMessageProblem(' a '), /at least 2/)
  assert.equal(chatMessageProblem('ok'), null)
  assert.equal(chatMessageProblem('x'.repeat(CHAT_MAX_CHARS)), null)
  assert.match(chatMessageProblem('x'.repeat(CHAT_MAX_CHARS + 1)), /under 500/)
})

test('a tool answer shows what was looked up and the rows from the books', () => {
  const view = describeChatReply({ mode: 'tool', tool: 'find_customers', query: 'Ahmed', result: { data: [{ id: 1, name: 'Ahmed Trading' }], asOf: '2026-10-18T10:00:00Z' } })
  assert.equal(view.kind, 'tool')
  assert.match(view.heading, /customers for “Ahmed”/)
  assert.equal(view.rows.length, 1)
  assert.equal(describeChatReply({ mode: 'tool', tool: 'product_stock', query: 'rice', result: { data: [] } }).rows.length, 0)
  assert.match(describeChatReply({ mode: 'tool', tool: 'product_stock', query: 'rice', result: { data: [] } }).heading, /products/)
})

test('model text is labelled as an unchecked suggestion', () => {
  const view = describeChatReply({ mode: 'reply', text: 'Try the customers list.' })
  assert.equal(view.kind, 'reply')
  assert.equal(view.heading, 'Assistant suggestion')
  assert.match(view.note, /not checked against your records/)
  assert.equal(view.rows.length, 0)
})

test('refusals and outages explain themselves and point to the lookups', () => {
  const refused = describeChatReply({ mode: 'refused', text: 'The daily AI limit for this company is used up.' })
  assert.equal(refused.kind, 'refused')
  assert.match(refused.text, /daily AI limit/)
  assert.match(refused.note, /Look up/)
  const off = describeChatReply({ mode: 'unavailable' })
  assert.equal(off.kind, 'unavailable')
  assert.match(off.text, /not available/)
  assert.equal(describeChatReply(undefined).kind, 'unavailable')
  // A tool mode without a result never invents rows.
  assert.equal(describeChatReply({ mode: 'tool', tool: 'find_customers' }).kind, 'unavailable')
})
