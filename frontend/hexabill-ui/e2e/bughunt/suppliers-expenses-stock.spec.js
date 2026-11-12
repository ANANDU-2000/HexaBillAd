// T4 hunt 2: Suppliers, Expenses, Stock adjustment: API edge inputs. Synthetic tenant only.
import { test, expect } from '@playwright/test'
import { apiLogin, API, EDGE } from '../session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function raw (path, method = 'GET', body, key) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { method,
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json, data: json.data }
}
const ok = async (...a) => { const r = await raw(...a); expect(r.status, `${a[0]} ${JSON.stringify(r.json).slice(0, 200)}`).toBeLessThan(300); return r.data }
const is4xx = (r, label) => { expect(r.status, `${label} ${JSON.stringify(r.json).slice(0, 160)}`).toBeGreaterThanOrEqual(400); expect(r.status, label).toBeLessThan(500) }
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const enc = encodeURIComponent

test('suppliers: names with slash, hash, question mark, percent, emoji and Arabic can be created, fetched, edited and deleted (UI uses encodeURIComponent)', async () => {
  const st = stamp()
  const bad = []
  for (const tail of ['A/B Trading', 'Gulf # One', 'What? Co', '100% Fresh', 'Fresh \u{1F34E} Fruits', 'مورد الخليج', 'Dot. Name.']) {
    const name = `${tail} ${st}`
    const c = await raw('/api/suppliers', 'POST', { name })
    if (c.status >= 300) { bad.push(`create "${tail}" ${c.status}`); continue }
    const g = await raw(`/api/suppliers/by-name/${enc(name)}`)
    if (g.status >= 300) bad.push(`GET by-name "${tail}" ${g.status}`)
    const u = await raw(`/api/suppliers/${enc(name)}`, 'PUT', { phone: '0501234567' })
    if (u.status >= 300) bad.push(`PUT "${tail}" ${u.status}`)
    const s = await raw(`/api/suppliers/${enc(name)}/statement`)
    if (s.status >= 500 || s.status === 404) bad.push(`statement "${tail}" ${s.status}`)
    const d = await raw(`/api/suppliers/${enc(name)}`, 'DELETE')
    if (d.status >= 300) bad.push(`DELETE "${tail}" ${d.status}`)
  }
  expect(bad).toEqual([])
})

test('suppliers: empty / whitespace name and negative credit limit are 4xx', async () => {
  const st = stamp()
  is4xx(await raw('/api/suppliers', 'POST', { name: '' }), 'empty')
  is4xx(await raw('/api/suppliers', 'POST', { name: '   ' }), 'whitespace')
  is4xx(await raw('/api/suppliers', 'POST', { name: `Neg ${st}`, creditLimit: -1 }), 'negative credit limit')
})

test('BUG-30 supplier with a 500-char name is refused with 4xx (not a 500 from the database)', async () => {
  is4xx(await raw('/api/suppliers', 'POST', { name: 'S'.repeat(500) }), '500 chars')
})

test('supplier duplicate name differing by case is refused', async () => {
  const st = stamp()
  await ok('/api/suppliers', 'POST', { name: `Dup Co ${st}` })
  is4xx(await raw('/api/suppliers', 'POST', { name: `dup co ${st}` }), 'case-insensitive duplicate')
  await raw(`/api/suppliers/${enc(`Dup Co ${st}`)}`, 'DELETE')
})

test('supplier payment: 0 and negative are 4xx', async () => {
  const st = stamp(); const name = `Pay Sup ${st}`
  await ok('/api/suppliers', 'POST', { name })
  const pay = (amount) => raw(`/api/suppliers/${enc(name)}/payments`, 'POST', { amount, paymentDate: new Date().toISOString(), mode: 0 })
  is4xx(await pay(0), 'zero'); is4xx(await pay(-5), 'negative')
})

test('BUG-31 supplier payment of 1e12 (and a payment to a supplier owed nothing) is refused', async () => {
  const st = stamp(); const name = `Pay Sup2 ${st}`
  await ok('/api/suppliers', 'POST', { name })
  const r = await raw(`/api/suppliers/${enc(name)}/payments`, 'POST', { amount: 1e12, paymentDate: new Date().toISOString(), mode: 0 })
  expect(r.status, 'AED 1,000,000,000,000 payment recorded against a supplier with zero balance').toBeGreaterThanOrEqual(400)
})

async function expenseCat () { const c = await ok('/api/expenses/categories'); return (c.items || c)[0] }
const expBody = async (over = {}) => ({ categoryId: (await expenseCat()).id, amount: 12.5, date: new Date().toISOString().slice(0, 10), note: 'hunt', ...over })
const cleanExp = async (r) => { const id = r.data?.id; if (id) await raw(`/api/expenses/${id}`, 'DELETE') }

test('BUG-32 expense with amount 0 or negative is refused', async () => {
  const z = await raw('/api/expenses', 'POST', await expBody({ amount: 0 })); await cleanExp(z)
  const n = await raw('/api/expenses', 'POST', await expBody({ amount: -5 })); await cleanExp(n)
  expect({ zero: z.status >= 400, negative: n.status >= 400 }, 'negative expenses reduce reported spend').toEqual({ zero: true, negative: true })
})
test('BUG-33 expense of 1e12 is refused', async () => {
  const r = await raw('/api/expenses', 'POST', await expBody({ amount: 1e12 })); await cleanExp(r)
  is4xx(r, '1e12')
})
test('BUG-34 expense with a 5000-char note is refused with 4xx (currently 500)', async () => {
  const r = await raw('/api/expenses', 'POST', await expBody({ note: 'n'.repeat(5000) })); await cleanExp(r)
  is4xx(r, '5000 note')
})
test('expense with unknown category is 4xx', async () => {
  const r = await raw('/api/expenses', 'POST', await expBody({ categoryId: 99999999 })); await cleanExp(r)
  is4xx(r, 'category')
})
test('BUG-35 expense double submit with the same Idempotency-Key creates one expense (currently two)', async () => {
  const st = stamp(); const body = await expBody({ amount: 13.37, note: `dbl ${st}` })
  const rs = await Promise.all([raw('/api/expenses', 'POST', body, `ex-${st}`), raw('/api/expenses', 'POST', body, `ex-${st}`)])
  const list = await ok('/api/expenses?page=1&pageSize=100')
  const mine = (list.items || list.Items || list).filter((e) => (e.note || '').includes(`dbl ${st}`))
  for (const e of mine) await raw(`/api/expenses/${e.id}`, 'DELETE')
  expect(mine.length, `statuses ${rs.map((r) => r.status)}`).toBe(1)
})
test('expense amount with 3 decimals is stored with at most 2', async () => {
  const st = stamp()
  const r = await raw('/api/expenses', 'POST', await expBody({ amount: 10.005, note: `d3 ${st}` }))
  if (r.status < 300) {
    const list = await ok('/api/expenses?page=1&pageSize=100')
    const e = (list.items || list.Items || list).find((x) => (x.note || '').includes(`d3 ${st}`))
    await raw(`/api/expenses/${e.id}`, 'DELETE')
    expect(Math.round(Number(e.amount) * 100) / 100, `stored ${e.amount}`).toBe(Number(e.amount))
  }
})

async function newProd () { const st = stamp(); return ok('/api/products', 'POST', { sku: `SA-${st}`, nameEn: `Adj ${st}`, unitType: 'PIECE', conversionToBase: 1, costPrice: 1, sellPrice: 2 }) }

test('stock adjustment: unknown product is 4xx', async () => {
  const p = await newProd()
  is4xx(await raw('/api/stockadjustments', 'POST', { productId: 99999999, newStock: 5, reason: 'hunt' }), 'unknown product')
})
test('BUG-36 stock adjustment to 1e12 is refused', async () => {
  const p = await newProd()
  const r = await raw('/api/stockadjustments', 'POST', { productId: p.id, newStock: 1e12, reason: 'hunt' })
  expect(r.status, JSON.stringify(r.json).slice(0, 160)).toBeGreaterThanOrEqual(400)
})
test('BUG-37 stock adjustment to the value already in stock logs no phantom adjustment row (old == new)', async () => {
  const p = await newProd()
  const a = await raw('/api/stockadjustments', 'POST', { productId: p.id, newStock: 10, reason: 'hunt set' })
  expect(a.status, JSON.stringify(a.json).slice(0, 200)).toBeLessThan(300)
  expect(Number((await ok(`/api/products/${p.id}`)).stockQty)).toBe(10)
  const b = await raw('/api/stockadjustments', 'POST', { productId: p.id, newStock: 10, reason: 'hunt repeat' })
  const list = await ok(`/api/stockadjustments?page=1&pageSize=100`)
  const rows = (list.items || list.Items || list).filter((x) => Number(x.productId) === p.id)
  expect(rows.filter((x) => Number(x.oldStock) === Number(x.newStock)).length, `repeat status ${b.status}`).toBe(0)
})
