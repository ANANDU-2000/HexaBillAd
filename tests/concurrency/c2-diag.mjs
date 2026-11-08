// Narrows BUG-20: which payment shape loses the cached Customer.Balance update under concurrency.
import { call, sql1, allAtOnce, uuid } from './lib.mjs'
import { getContext, newProduct, newCustomer, saleBody } from './setup.mjs'
const G = (await getContext())['gulfharvest-test']
for (const variant of ['all-on-account', 'all-bound-to-one-invoice', 'each-bound-to-own-invoice']) {
  const prod = await newProduct(G.owner, { stock: 1000, tag: 'C2D' })
  const cust = await newCustomer(G.owner, 'C2D')
  const invs = []
  for (let i = 0; i < (variant === 'each-bound-to-own-invoice' ? 10 : 1); i++) invs.push((await call(G.owner, 'POST', '/api/sales', saleBody({ productId: prod.id, qty: 100, price: 10, customerId: cust.id }))).data)
  const total = invs.reduce((a, s) => a + s.grandTotal, 0)
  const res = await allAtOnce(G.admins.slice(0, 10).map((u, i) => () => call(u, 'POST', '/api/payments', { customerId: cust.id, amount: 10 + i, mode: 'CASH', ...(variant === 'all-bound-to-one-invoice' ? { saleId: invs[0].id } : variant === 'each-bound-to-own-invoice' ? { saleId: invs[i].id } : {}) }, { 'Idempotency-Key': uuid() })))
  const bal = Number(sql1(`select "Balance" from "Customers" where "Id"=${cust.id}`))
  console.log(variant, 'http', JSON.stringify(res.map((r) => r.status)), 'cachedBalance', bal, 'expected', total - 145, 'lost', bal - (total - 145))
}
