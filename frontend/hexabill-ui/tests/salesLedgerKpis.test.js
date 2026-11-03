import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSalesLedgerKpis } from '../src/utils/salesLedgerKpis.js'

const summary = {
  totalSales: 1500,
  totalReturns: 200,
  totalPayments: 900,
  totalVat: 71.43,
  totalRealPending: 600,
  pendingBalance: 600,
  totalInvoices: 7,
}

test('builds exactly eight KPI cards in the agreed order', () => {
  const cards = buildSalesLedgerKpis(summary, { rowCount: 42, returnCount: 2 })
  assert.deepEqual(
    cards.map((c) => c.key),
    ['sales', 'returns', 'received', 'vat', 'unpaid', 'balance', 'invoices', 'rows'],
  )
})

test('card values come from the same filtered summary the table uses', () => {
  const byKey = Object.fromEntries(
    buildSalesLedgerKpis(summary, { rowCount: 42, returnCount: 2 }).map((c) => [c.key, c.value]),
  )
  assert.equal(byKey.sales, 1500)
  assert.equal(byKey.returns, 200)
  assert.equal(byKey.received, 900)
  assert.equal(byKey.vat, 71.43)
  assert.equal(byKey.unpaid, 600)
  assert.equal(byKey.balance, 600)
  assert.equal(byKey.invoices, 7)
  assert.equal(byKey.rows, 42)
})

test('money cards use the currency formatter, counts do not', () => {
  const cards = Object.fromEntries(
    buildSalesLedgerKpis(summary, { rowCount: 42, returnCount: 2 }).map((c) => [c.key, c]),
  )
  assert.equal(cards.sales.format, 'money')
  assert.equal(cards.balance.format, 'balance')
  assert.equal(cards.invoices.format, 'count')
  assert.equal(cards.rows.format, 'count')
})

test('returns helper uses singular and plural correctly', () => {
  const one = buildSalesLedgerKpis(summary, { rowCount: 1, returnCount: 1 })
  const many = buildSalesLedgerKpis(summary, { rowCount: 1, returnCount: 3 })
  assert.equal(one.find((c) => c.key === 'returns').helper, '1 return')
  assert.equal(many.find((c) => c.key === 'returns').helper, '3 returns')
})

test('missing or partial summary yields zeros, never NaN or undefined', () => {
  const cards = buildSalesLedgerKpis(undefined, {})
  assert.equal(cards.length, 8)
  for (const card of cards) {
    assert.equal(card.value, 0, `${card.key} should default to 0`)
  }
  const partial = buildSalesLedgerKpis({ totalSales: 'not-a-number' }, {})
  assert.equal(partial.find((c) => c.key === 'sales').value, 0)
})
