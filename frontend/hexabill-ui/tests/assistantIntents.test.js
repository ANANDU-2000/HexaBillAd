import test from 'node:test'
import assert from 'node:assert/strict'
import { detectIntent, extractAmount, extractParty, extractMode, extractCategory, normalizeDigits } from '../src/features/assistant/assistantIntents.js'

test('chips resolve without a model', () => {
  assert.equal(detectIntent("Show today's business summary").tool, 'dashboard_summary')
  assert.equal(detectIntent('Which customers are overdue on routes?').tool, 'route_overdue')
  assert.equal(detectIntent('Show low stock products').tool, 'low_stock_products')
  assert.equal(detectIntent('Record payment received').kind, 'new_payment')
  assert.equal(detectIntent('Create new sale invoice').kind, 'new_sale')
  assert.equal(detectIntent('Record expense').kind, 'new_expense')
  assert.equal(detectIntent('Add new customer').kind, 'new_customer')
  assert.equal(detectIntent('Add new product').kind, 'new_product')
})

test('payment phrase fills customer, amount and mode', () => {
  const i = detectIntent('Received 500 AED from Al Noor in cash')
  assert.equal(i.kind, 'new_payment')
  assert.deepEqual({ c: i.fields.customerName, a: i.fields.amount, m: i.fields.mode }, { c: 'Al Noor', a: '500', m: 'CASH' })
  assert.equal(detectIntent('received 1,250.50 from Star Mart by bank transfer').fields.amount, '1250.5')
  assert.equal(detectIntent('received 1,250.50 from Star Mart by bank transfer').fields.mode, 'ONLINE')
})

test('expense phrase picks category and amount, and is not mistaken for a payment', () => {
  const i = detectIntent('Record 80 AED fuel expense')
  assert.equal(i.kind, 'new_expense')
  assert.equal(i.fields.amount, '80')
  assert.equal(i.fields.categoryName, 'Fuel')
  assert.equal(detectIntent('paid 300 for rent').fields.categoryName, 'Rent')
})

test('malayalam, hindi and arabic digits and keywords', () => {
  assert.equal(normalizeDigits('൫൦൦ ٥٠٠ ५००'), '500 500 500')
  assert.equal(extractAmount('ചെലവ് ൮൦ ദിർഹം'), '80')
  assert.equal(detectIntent('ഇന്നത്തെ വിൽപ്പന').tool, 'dashboard_summary')
  assert.equal(detectIntent('खर्च 80 petrol').kind, 'new_expense')
  assert.equal(detectIntent('مصروف 80 بنزين').kind, 'new_expense')
})

test('stock question becomes a product lookup', () => {
  const i = detectIntent('how much stock of basmati rice')
  assert.equal(i.tool, 'product_stock')
  assert.equal(i.args.query, 'basmati rice')
})

test('unrelated text is left for the AI router', () => {
  assert.equal(detectIntent('hello'), null)
  assert.equal(detectIntent('x'), null)
  assert.equal(detectIntent(''), null)
})

test('phone-length numbers are not amounts; negative or zero ignored', () => {
  assert.equal(extractAmount('call 0501234567890'), '')
  assert.equal(extractAmount('0 and 25'), '25')
})

test('helpers', () => {
  assert.equal(extractParty('Received 500 from Al Noor.'), 'Al Noor')
  assert.equal(extractParty('received cash'), '')
  assert.equal(extractMode('pay by card'), 'ONLINE')
  assert.equal(extractCategory('bought diesel'), 'Fuel')
})
