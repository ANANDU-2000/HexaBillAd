// Synthetic fixtures for specs that need existing money records. They are created through the real API on the
// synthetic tenant only when none exist, so a fresh seed and a used database behave the same.
import { apiLogin, API, EDGE } from './session.js'

async function call (slug, path, method = 'GET', body, key) {
  const s = await apiLogin(slug)
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`fixture ${method} ${path}: ${r.status} ${JSON.stringify(json).slice(0, 200)}`)
  return json.data
}

const rows = (d) => d?.items || d?.Items || (Array.isArray(d) ? d : [])

async function branchScope (slug) {
  // Once the tenant has branches, customers need a branch and route.
  const branches = rows(await call(slug, '/api/branches'))
  if (!branches.length) return {}
  const routes = rows(await call(slug, '/api/routes'))
  const route = routes.find((r) => r.branchId === branches[0].id)
  return route ? { branchId: branches[0].id, routeId: route.id } : {}
}

async function newProduct (slug, stamp, stockQty) {
  return call(slug, '/api/products', 'POST', {
    sku: `FX-${stamp}`, nameEn: `Fixture item ${stamp}`, unitType: 'PIECE', conversionToBase: 1, costPrice: 10, sellPrice: 15, stockQty,
  })
}

/** Makes sure one customer has an unpaid credit sale (a real invoice, so payments can be applied to it). */
export async function ensureOwingCustomer (slug) {
  const existing = rows(await call(slug, '/api/customers?page=1&pageSize=100')).find((c) => Number(c.balance) > 1)
  if (existing) return existing
  return createOwingCustomer(slug)
}

/** Makes sure the tenant has at least `count` customers (plain, no sales); returns how many exist. */
export async function ensureCustomerCount (slug, count) {
  let n = rows(await call(slug, '/api/customers?page=1&pageSize=200')).length
  const scope = n < count ? await branchScope(slug) : {}
  for (; n < count; n += 1) {
    const stamp = `${Date.now()}${n}`
    await call(slug, '/api/customers', 'POST', { name: `Fixture customer ${stamp}`, phone: `055${stamp.slice(-7)}`, creditLimit: 0, customerType: 'Credit', ...scope })
  }
  return n
}

/** Makes sure at least `count` customers owe more than `minBalance`; returns them, largest balance first. */
export async function ensureOwingCustomers (slug, count, minBalance = 60) {
  let list = (await call(slug, '/api/customers?page=1&pageSize=100').then(rows)).filter((c) => Number(c.balance) > minBalance)
  while (list.length < count) {
    await createOwingCustomer(slug)
    list = (await call(slug, '/api/customers?page=1&pageSize=100').then(rows)).filter((c) => Number(c.balance) > minBalance)
  }
  return list.sort((a, b) => Number(b.balance) - Number(a.balance))
}

/** Creates a brand-new customer with its own stocked product and one unpaid credit invoice (isolated data). */
export async function createOwingCustomer (slug, name) {
  const stamp = `${Date.now()}`
  const customer = await call(slug, '/api/customers', 'POST', {
    name: name || `Fixture owing ${stamp}`, phone: `056${stamp.slice(-7)}`, creditLimit: 5000, customerType: 'Credit', ...(await branchScope(slug)),
  })
  const product = await newProduct(slug, stamp, 0)
  // Stock arrives through a real cash purchase, the same way the app receives goods.
  await call(slug, '/api/purchases', 'POST', {
    supplierName: `Fixture stock ${stamp}`, invoiceNo: `FXS-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10),
    paymentType: 'Cash', items: [{ productId: product.id, unitType: 'PIECE', qty: 50, unitCost: 10 }],
  }, `fx-stock-${stamp}`)
  await call(slug, '/api/sales', 'POST', {
    customerId: customer.id, externalReference: `fixture-${stamp}`, items: [{ productId: product.id, unitType: 'PIECE', qty: 10, unitPrice: 15 }],
  })
  return customer
}

/** Makes sure one purchase on credit exists with a balance still owed to the supplier. */
export async function ensureUnpaidPurchase (slug) {
  const open = rows(await call(slug, '/api/purchases?page=1&pageSize=50'))
    .find((p) => Number(p.balanceAmount ?? p.totalAmount) > 0.009 && (p.paymentStatus || '').toLowerCase() !== 'paid')
  if (open) return open
  const stamp = `${Date.now()}`
  const product = await newProduct(slug, stamp, 0)
  return call(slug, '/api/purchases', 'POST', {
    supplierName: `Fixture supplier ${stamp}`, invoiceNo: `FX-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10),
    paymentType: 'Credit', items: [{ productId: product.id, unitType: 'PIECE', qty: 20, unitCost: 10 }],
  }, `fx-purchase-${stamp}`)
}

/** A fresh owing customer with a very long name and one cleared cash payment, for row-layout checks. */
export async function createLongNamePayment (slug) {
  const stamp = `${Date.now()}`
  const name = `QA long name customer ${stamp} Trading Company Limited Liability Partnership`
  const customer = await createOwingCustomer(slug, name)
  await call(slug, '/api/payments', 'POST', {
    customerId: customer.id, saleId: null, amount: 12.34, mode: 'CASH', reference: null, paymentDate: new Date().toISOString(),
  }, `fx-longname-${stamp}`)
  return { customer, name }
}
