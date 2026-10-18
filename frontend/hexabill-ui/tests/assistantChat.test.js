import test from 'node:test'
import assert from 'node:assert/strict'
import { chatMessageProblem, describeChatReply, CHAT_MAX_CHARS, suggestionRows, prefillFor } from '../src/features/assistant/assistantChat.js'

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

test('unsupported model text is replaced with fixed help', () => {
  const view = describeChatReply({ mode: 'reply', text: 'VAT payable is AED 999999. Pay it now.' })
  assert.equal(view.kind, 'reply')
  assert.equal(view.heading, 'Assistant help')
  assert.doesNotMatch(view.text, /999999|Pay it now/)
  assert.match(view.text, /look up customers/)
  assert.match(view.note, /your company/)
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

test('a suggested form is described with its own fields and a plain reminder that nothing is saved', () => {
  const view = describeChatReply({ mode: 'suggestion', suggestion: { kind: 'new_customer', fields: { name: 'Al Noor', phone: '0501234567', ignored: 'x' }, dropped: ['email'] } })
  assert.equal(view.kind, 'suggestion')
  assert.match(view.heading, /a new customer/)
  assert.match(view.note, /Nothing is saved/)
  assert.deepEqual(view.rows.map((r) => r.label), ['Name', 'Phone'])
  assert.deepEqual(view.dropped, ['email'])
  assert.equal(describeChatReply({ mode: 'suggestion' }).kind, 'unavailable')
  assert.deepEqual(suggestionRows('new_expense', { amount: '10', note: 'n', categoryName: 'Fuel' }).map((r) => r.label), ['Category', 'Amount', 'Note'])
})

test('suggested values become the normal form\'s starting values; the category is matched by name or left for the person', () => {
  assert.deepEqual(prefillFor('new_customer', { name: 'A', phone: '1', extra: 'no' }), { name: 'A', phone: '1', email: '', address: '', trn: '' })
  const categories = [{ id: 3, name: 'Fuel' }, { id: 4, name: 'Vehicle Maintenance' }, { id: 5, name: 'Vehicle Insurance' }]
  assert.equal(prefillFor('new_expense', { categoryName: 'fuel', amount: '125.5' }, categories).categoryId, '3')
  assert.equal(prefillFor('new_expense', { categoryName: 'maintenance' }, categories).categoryId, '4')
  assert.equal(prefillFor('new_expense', { categoryName: 'Vehicle' }, categories).categoryId, '') // two partial matches: not guessed
  assert.equal(prefillFor('new_expense', { categoryName: 'Rent' }, categories).categoryId, '')
  assert.equal(prefillFor('new_expense', { amount: '9' }, categories).amount, '9')
  assert.equal(prefillFor('new_expense', {}, undefined).categoryId, '')
})

