// T4 bug hunt 1: API edge inputs on POS sales, payments, returns, products, purchases (synthetic tenant only).
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function raw (path, method = 'GET', body, key) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json, data: json.data }
}
const ok = async (...a) => { const r = await raw(...a); expect(r.status, `${a[0]} ${JSON.stringify(r.json).slice(0, 200)}`).toBeLessThan(300); return r.data }
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const is4xx = (r, label) => { expect(r.status, `${label} ${JSON.stringify(r.json).slice(0, 160)}`).toBeGreaterThanOrEqual(400); expect(r.status, label).toBeLessThan(500) }

async function setup (stockQty = 100) {
  const st = stamp()
  const customer = await ok('/api/customers', 'POST', { name: `Hunt cust ${st}`, creditLimit: 100000, customerType: 'Credit' })
  const product = await ok('/api/products', 'POST', { sku: `H-${st}`, nameEn: `Hunt ${st}`, unitType: 'PIECE', conversionToBase: 1, costPrice: 10, sellPrice: 15 })
  // Stock can only arrive through a purchase or stock adjustment (product create always starts at 0).
  if (stockQty > 0) {
    await ok('/api/purchases', 'POST', { supplierName: `Hunt stock ${st}`, invoiceNo: `HS-${st}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash',
      items: [{ productId: product.id, unitType: 'PIECE', qty: stockQty, unitCost: 10 }] }, `hs-${st}`)
  }
  return { st, customer, product }
}
const line = (p, qty, unitPrice = 15) => ({ productId: p.id, unitType: 'PIECE', qty, unitPrice })

test('payments reject 0, negative amounts with 4xx (not 5xx)', async () => {
  const { customer } = await setup()
  for (const amount of [0, -5, -0.001]) {
    is4xx(await raw('/api/payments', 'POST', { customerId: customer.id, amount, mode: 'CASH' }, `h-${stamp()}`), `amount ${amount}`)
  }
})

test('payment with 3 decimals is stored with at most 2 decimals', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `p3-${st}`, items: [line(product, 4)] })
  const r = await raw('/api/payments', 'POST', { customerId: customer.id, saleId: sale.id, amount: 10.005, mode: 'CASH' }, `p3-${st}`)
  if (r.status < 300) {
    const list = await ok(`/api/payments?customerId=${customer.id}&page=1&pageSize=50`)
    const amt = Number((list.items || list.Items || list)[0].amount)
    const detail = await ok(`/api/sales/${sale.id}`)
    expect(Math.round(amt * 100) / 100, `list shows ${amt}, create response ${r.data.payment?.amount}, sale paid ${detail.paidAmount}`).toBe(amt)
  }
})

test('overpayment against an invoice is refused', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `op-${st}`, items: [line(product, 2)] })
  const r = await raw('/api/payments', 'POST', { customerId: customer.id, saleId: sale.id, amount: Number(sale.grandTotal) * 10, mode: 'CASH' }, `op-${st}`)
  expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBeGreaterThanOrEqual(400)
})

test('double-submit payment with the same idempotency key creates exactly one payment', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `dp-${st}`, items: [line(product, 4)] })
  const body = { customerId: customer.id, saleId: sale.id, amount: 10, mode: 'CASH' }
  const rs = await Promise.all([raw('/api/payments', 'POST', body, `dp-${st}`), raw('/api/payments', 'POST', body, `dp-${st}`)])
  const list = await ok(`/api/payments?customerId=${customer.id}&page=1&pageSize=50`)
  const items = list.items || list.Items || list
  expect(items.filter((p) => Number(p.amount) === 10).length, rs.map((r) => r.status).join(',')).toBe(1)
})

test('concurrent payments with DIFFERENT keys cannot exceed the invoice balance', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `cp-${st}`, items: [line(product, 4)] })
  const total = Number(sale.grandTotal)
  const body = { customerId: customer.id, saleId: sale.id, amount: total, mode: 'CASH' }
  await Promise.all([1, 2, 3].map((i) => raw('/api/payments', 'POST', body, `cp-${st}-${i}`)))
  const detail = await ok(`/api/sales/${sale.id}`)
  expect(Number(detail.paidAmount ?? 0), 'paid must not exceed invoice total').toBeLessThanOrEqual(total + 0.005)
})

test('sale double-submit with same externalReference yields one invoice and one stock deduction', async () => {
  const { st, customer, product } = await setup()
  const body = { customerId: customer.id, externalReference: `ds-${st}`, items: [line(product, 3)] }
  const rs = await Promise.all([raw('/api/sales', 'POST', body), raw('/api/sales', 'POST', body), raw('/api/sales', 'POST', body)])
  const ids = new Set(rs.filter((r) => r.status < 300).map((r) => r.data?.id))
  expect(ids.size, rs.map((r) => r.status).join(',')).toBe(1)
  const p = await ok(`/api/products/${product.id}`)
  expect(Number(p.stockQty), 'stock deducted once').toBe(97)
})

test('concurrent sales cannot oversell stock (negative stock disallowed)', async () => {
  await ok('/api/settings', 'PUT', { ALLOW_NEGATIVE_STOCK: 'false' })
  test.info().annotations.push({ type: 'note', description: 'restored in finally' })
  const { st, customer, product } = await setup(5)
  try {
  const mk = (i) => raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `os-${st}-${i}`, items: [line(product, 4)] })
  const rs = await Promise.all([1, 2, 3].map(mk))
  const p = await ok(`/api/products/${product.id}`)
  expect(Number(p.stockQty), `statuses ${rs.map((r) => r.status)}`).toBeGreaterThanOrEqual(0)
  } finally { await raw('/api/settings', 'PUT', { ALLOW_NEGATIVE_STOCK: 'true' }) }
})

test('sale edge inputs: qty 0 / negative / 1e9 price / 501-char notes are 4xx, emoji and Arabic accepted', async () => {
  const { st, customer, product } = await setup()
  for (const qty of [0, -1]) {
    is4xx(await raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `q-${st}-${qty}`, items: [line(product, qty)] }), `qty ${qty}`)
  }
  is4xx(await raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `big-${st}`, items: [line(product, 1, 1e9)] }), 'price 1e9')
  is4xx(await raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `long-${st}`, notes: 'x'.repeat(501), items: [line(product, 1)] }), 'notes 501')
  const emoji = await raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `em-${st}`, notes: 'شكرا \u{1F600} ' + 'ا'.repeat(100), items: [line(product, 1)] })
  expect(emoji.status, JSON.stringify(emoji.json).slice(0, 200)).toBeLessThan(300)
})

test('sale qty/price with 3 decimals: stored subtotal is 2dp and equals the sum of lines', async () => {
  const { st, customer, product } = await setup()
  const sale = await raw('/api/sales', 'POST', { customerId: customer.id, externalReference: `d3-${st}`, items: [line(product, 1.005, 15.005)] })
  if (sale.status < 300) {
    const d = await ok(`/api/sales/${sale.data.id}`)
    const sum = d.items.reduce((a, i) => a + Number(i.lineTotal ?? i.total ?? 0), 0)
    expect(Math.round(Number(d.subtotal) * 100) / 100).toBe(Number(d.subtotal))
    expect(Math.abs(Number(d.subtotal) - sum)).toBeLessThan(0.011)
  }
})

test('returns: qty 0 / negative / more than sold are refused (4xx)', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `r-${st}`, items: [line(product, 2)] })
  const d = await ok(`/api/sales/${sale.id}`)
  const itemId = d.items[0].id
  const ret = (qty) => raw('/api/returns/sales', 'POST', { saleId: sale.id, returnType: 'CreditIssued', reason: 'hunt', items: [{ saleItemId: itemId, qty, stockEffect: true, condition: 'resellable' }] })
  for (const qty of [0, -1, 3]) is4xx(await ret(qty), `qty ${qty}`)
})

test('concurrent returns cannot return more than sold', async () => {
  const { st, customer, product } = await setup()
  const sale = await ok('/api/sales', 'POST', { customerId: customer.id, externalReference: `rc-${st}`, items: [line(product, 2)] })
  const d = await ok(`/api/sales/${sale.id}`)
  const itemId = d.items[0].id
  const ret = () => raw('/api/returns/sales', 'POST', { saleId: sale.id, returnType: 'CreditIssued', reason: 'hunt', items: [{ saleItemId: itemId, qty: 2, stockEffect: true, condition: 'resellable' }] })
  const rs = await Promise.all([ret(), ret(), ret()])
  expect(rs.filter((r) => r.status < 300).length, rs.map((r) => r.status).join(',')).toBe(1)
  const p = await ok(`/api/products/${product.id}`)
  expect(Number(p.stockQty)).toBe(100)
})

test('products: duplicate SKU, 500-char name, negative cost, negative stock are refused with 4xx', async () => {
  const { st, product } = await setup()
  const base = { unitType: 'PIECE', conversionToBase: 1, costPrice: 1, sellPrice: 2, stockQty: 0 }
  is4xx(await raw('/api/products', 'POST', { ...base, sku: product.sku, nameEn: 'dup' }), 'dup sku')
  is4xx(await raw('/api/products', 'POST', { ...base, sku: `L-${st}`, nameEn: 'n'.repeat(500) }), 'long name')
  is4xx(await raw('/api/products', 'POST', { ...base, sku: `N-${st}`, nameEn: 'neg', costPrice: -1 }), 'neg cost')
  is4xx(await raw('/api/products', 'POST', { ...base, sku: `NS-${st}`, nameEn: 'negstock', stockQty: -5 }), 'neg stock')
})

test('purchases: qty 0 / negative cost / negative qty refused; double submit same key = one; duplicate invoice no refused', async () => {
  const { st, product } = await setup()
  const mk = (over = {}) => ({ supplierName: `Hunt sup ${st}`, invoiceNo: `HP-${st}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Credit',
    items: [{ productId: product.id, unitType: 'PIECE', qty: 5, unitCost: 10 }], ...over })
  for (const items of [
    [{ productId: product.id, unitType: 'PIECE', qty: 0, unitCost: 10 }],
    [{ productId: product.id, unitType: 'PIECE', qty: 5, unitCost: -10 }],
    [{ productId: product.id, unitType: 'PIECE', qty: -5, unitCost: 10 }]]) {
    is4xx(await raw('/api/purchases', 'POST', mk({ items, invoiceNo: `HQ-${stamp()}` }), `hq-${stamp()}`), JSON.stringify(items))
  }
  const rs = await Promise.all([raw('/api/purchases', 'POST', mk(), `hp-${st}`), raw('/api/purchases', 'POST', mk(), `hp-${st}`)])
  const p = await ok(`/api/products/${product.id}`)
  expect(Number(p.stockQty), rs.map((r) => r.status).join(',')).toBe(105)
  is4xx(await raw('/api/purchases', 'POST', mk(), `hp2-${st}`), 'duplicate supplier invoice number')
})
