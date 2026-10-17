import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAssistantEnabled, ASSISTANT_STORAGE_KEY, fieldErrorMap, canConfirm, newIdempotencyKey, describeConfirmFailure, toDraftRequest, emptyCustomerForm,
} from '../src/features/assistant/assistantDraft.js'

const memory = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: (k) => m.get(k) ?? null } }

test('assistant is off by default and on only by build flag or browser switch', () => {
  assert.equal(isAssistantEnabled({}, memory()), false)
  assert.equal(isAssistantEnabled({ VITE_ENABLE_ASSISTANT: 'true' }, memory()), true)
  assert.equal(isAssistantEnabled({ VITE_ENABLE_ASSISTANT: 'false' }, memory()), false)
  assert.equal(isAssistantEnabled({}, memory({ [ASSISTANT_STORAGE_KEY]: '1' })), true)
  assert.equal(isAssistantEnabled({}, memory({ [ASSISTANT_STORAGE_KEY]: '0' })), false)
})

test('unavailable storage never turns the assistant on or throws', () => {
  assert.equal(isAssistantEnabled({}, { getItem() { throw new Error('blocked') } }), false)
})

test('field errors map to the first message per field', () => {
  const map = fieldErrorMap([{ field: 'name', message: 'a' }, { field: 'name', message: 'b' }, { field: 'email', message: 'c' }])
  assert.deepEqual(map, { name: 'a', email: 'c' })
  assert.deepEqual(fieldErrorMap(undefined), {})
})

test('confirm is possible only for a clean, plain draft with a hash', () => {
  assert.equal(canConfirm({ status: 'Draft', errors: [], payloadHash: 'x' }), true)
  assert.equal(canConfirm({ status: 'Draft', errors: [{ field: 'name', message: 'm' }], payloadHash: 'x' }), false)
  assert.equal(canConfirm({ status: 'Confirmed', errors: [], payloadHash: 'x' }), false)
  assert.equal(canConfirm({ status: 'Draft', errors: [], payloadHash: '' }), false)
  assert.equal(canConfirm(null), false)
})

test('idempotency keys are long enough for the server and differ between drafts', () => {
  const a = newIdempotencyKey()
  const b = newIdempotencyKey()
  assert.ok(a.length >= 8 && a.length <= 80)
  assert.notEqual(a, b)
  assert.ok(newIdempotencyKey({}).length >= 8) // no crypto available
})

test('a lost or server-error confirm is never offered as a blind retry', () => {
  const uncertain = describeConfirmFailure(500, 'boom')
  assert.equal(uncertain.retry, false)
  assert.equal(uncertain.uncertain, true)
  assert.match(uncertain.text, /not certain/)
  assert.equal(describeConfirmFailure(undefined, '').uncertain, true)
})

test('client-side refusals explain themselves and ask to review again', () => {
  assert.equal(describeConfirmFailure(410, 'This draft has expired.').startOver, true)
  assert.equal(describeConfirmFailure(409, 'changed').startOver, true)
  assert.equal(describeConfirmFailure(400, 'Fix the highlighted fields').startOver, false)
  assert.match(describeConfirmFailure(404).text, /no longer available/)
})

test('draft request keeps text as typed and turns an empty credit limit into 0', () => {
  const form = { ...emptyCustomerForm(), name: ' Acme ', creditLimit: '' }
  const body = toDraftRequest(form)
  assert.equal(body.name, ' Acme ')
  assert.equal(body.creditLimit, 0)
  assert.equal(toDraftRequest({ ...form, creditLimit: '250.5' }).creditLimit, 250.5)
})

test('uncertain wording names the right list for expenses', () => {
  const r = describeConfirmFailure(500, 'boom', 'Expenses', 'expense')
  assert.match(r.text, /Expenses list/)
  assert.match(r.text, /this expense again/)
  assert.match(describeConfirmFailure(500, 'boom').text, /Customers list/)
})

test('expense form defaults to today and maps empty fields to values the server can reject', async () => {
  const { emptyExpenseForm, toExpenseDraftRequest } = await import('../src/features/assistant/assistantDraft.js')
  const form = emptyExpenseForm(new Date(2026, 9, 5))
  assert.equal(form.date, '2026-10-05')
  assert.deepEqual(toExpenseDraftRequest(form), { categoryId: 0, amount: 0, date: '2026-10-05', note: '' })
  assert.deepEqual(toExpenseDraftRequest({ categoryId: '3', amount: '12.345', date: '2026-10-05', note: 'fuel' }), { categoryId: 3, amount: 12.345, date: '2026-10-05', note: 'fuel' })
})
