// T5 concurrency scenarios C1..C9 against the LOCAL synthetic API. See README.md.
import fs from 'node:fs'
import path from 'node:path'
import { call, login, sql, sql1, allAtOnce, summarize, uuid, logOffset, logDelta, r2 } from './lib.mjs'
import { getContext, newProduct, newCustomer, saleBody } from './setup.mjs'

const RUNS = Number(process.env.HEXABILL_CONC_RUNS || 3)
const WANT = (process.env.HEXABILL_CONC_SCENARIOS || 'c1,c2,c3,c6,c7').split(',').map((s) => s.trim().toLowerCase())
const OUT = path.resolve('docs/uiux/evidence/concurrency')
fs.mkdirSync(OUT, { recursive: true })

const ctx = await getContext()
const G = ctx['gulfharvest-test']; const F = ctx['frozenhub1-test']
const T = G.tenantId
const num = (x) => Number(x)
const check = (name, pass, detail = '') => ({ name, pass: !!pass, detail: String(detail) })

/** Tenant-wide SQL invariants (FINANCE-INVARIANTS: ledger = invoices, payments <= invoices, stock = purchases - sales). */
let custFloor = 0
function invariants (tid) {
  const out = []
  const dup = sql1(`select count(*) from (select "InvoiceNo" from "Sales" where "TenantId"=${tid} and "IsDeleted"=false group by 1 having count(*)>1) x`)
  out.push(check('unique invoice numbers per tenant', dup === '0', `duplicate numbers: ${dup}`))
  const [cnt, mn, mx] = sql(`select count(*), coalesce(min(n),0), coalesce(max(n),0) from (select "InvoiceNo"::bigint n from "Sales" where "TenantId"=${tid} and "IsDeleted"=false and "InvoiceNo" ~ '^[0-9]{1,9}$') x`)[0].map(num)
  out.push(check('invoice numbers gapless (numeric series)', cnt === 0 || mx - mn + 1 === cnt, `count=${cnt} min=${mn} max=${mx} gaps=${mx - mn + 1 - cnt}`))
  const over = sql1(`select count(*) from "Sales" where "TenantId"=${tid} and "IsDeleted"=false and "PaidAmount" > "GrandTotal"+0.005`)
  out.push(check('Sale.PaidAmount <= GrandTotal', over === '0', `overpaid invoices: ${over}`))
  const overSum = sql1(`select count(*) from "Sales" s where s."TenantId"=${tid} and s."IsDeleted"=false and coalesce((select sum(p."Amount") from "Payments" p where p."SaleId"=s."Id" and p."Status"='CLEARED'),0) > s."GrandTotal"+0.005`)
  out.push(check('sum of cleared payments per invoice <= GrandTotal', overSum === '0', `invoices with payments above total: ${overSum}`))
  const mism = sql1(`select count(*) from "Sales" s where s."TenantId"=${tid} and s."IsDeleted"=false and s."CustomerId" in (select "Id" from "Customers" where "TenantId"=${tid} and "Name" like 'ZZ-T5%') and abs(s."PaidAmount" - coalesce((select sum(p."Amount") from "Payments" p where p."SaleId"=s."Id" and p."Status"='CLEARED'),0))>0.005`)
  out.push(check('Sale.PaidAmount = cleared payments on that invoice', mism === '0', `mismatches: ${mism}`))
  const stock = sql(`select p."Id", p."StockQty", coalesce((select sum("ChangeQty") from "InventoryTransactions" i where i."ProductId"=p."Id"),0) from "Products" p where p."TenantId"=${tid} and p."NameEn" like 'ZZ-T5%' and abs(p."StockQty" - coalesce((select sum("ChangeQty") from "InventoryTransactions" i where i."ProductId"=p."Id"),0))>0.0001`)
  out.push(check('stock = purchases - sales +/- adjustments (all ZZ-T5 products)', stock.length === 0, stock.length ? `bad products: ${JSON.stringify(stock.slice(0, 5))}` : 'ok'))
  const balExpr = `(coalesce((select sum("GrandTotal") from "Sales" s where s."CustomerId"=c."Id" and s."IsDeleted"=false),0) - coalesce((select sum("Amount") from "Payments" p where p."CustomerId"=c."Id" and p."Status"='CLEARED'),0))`
  const bal = sql(`select c."Id", c."Balance", ${balExpr} from "Customers" c where c."TenantId"=${tid} and c."Id">${custFloor} and c."Name" like 'ZZ-T5%' and abs(c."Balance" - ${balExpr})>0.005`)
  out.push(check('customer balance = invoices - cleared payments (customers created in this run)', bal.length === 0, bal.length ? `bad customers (id,cached,expected): ${JSON.stringify(bal.slice(0, 5))}` : 'ok'))
  return out
}

/** Customer ledger debits must equal that customer's invoice totals; credits the cleared payments. */
async function ledgerCheck (session, customerId) {
  const l = await call(session, 'GET', `/api/customers/${customerId}/ledger`)
  const rows = Array.isArray(l.data) ? l.data : []
  const debit = rows.reduce((a, r) => a + Number(r.debit || 0), 0)
  const credit = rows.reduce((a, r) => a + Number(r.credit || 0), 0)
  const inv = num(sql1(`select coalesce(sum("GrandTotal"),0) from "Sales" where "CustomerId"=${customerId} and "IsDeleted"=false`))
  const pay = num(sql1(`select coalesce(sum("Amount"),0) from "Payments" where "CustomerId"=${customerId} and "Status"='CLEARED'`))
  return [
    check(`ledger debits = sum of invoice totals (customer ${customerId})`, l.status === 200 && Math.abs(debit - inv) < 0.01, `ledger debit=${r2(debit)} invoices=${r2(inv)} http=${l.status}`),
    check(`ledger credits = cleared payments (customer ${customerId})`, l.status === 200 && Math.abs(credit - pay) < 0.01, `ledger credit=${r2(credit)} payments=${r2(pay)}`),
  ]
}

const noServerErrors = (res, label = 'no 5xx / network errors') => check(label, res.every((r) => r.status > 0 && r.status < 500), `5xx/net=${res.filter((r) => r.status === 0 || r.status >= 500).length} statuses=${JSON.stringify(summarize(res).statuses)}`)
const logChecks = (off) => { const d = logDelta(off); return [check('no deadlocks (pg_stat_database delta)', d.deadlocks === 0, `deadlock=${d.deadlocks} serialization=${d.serialization}`), check('no connection errors / timeouts (status 0 or 5xx) in this scenario', true, 'enforced by the no-5xx check above')] }

async function setNegStock (value) {
  const r = await call(G.owner, 'PUT', '/api/settings', { ALLOW_NEGATIVE_STOCK: value })
  if (r.status >= 300) throw new Error(`settings PUT ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
  const back = await call(G.owner, 'GET', '/api/settings')
  if (String(back.data?.ALLOW_NEGATIVE_STOCK).toLowerCase() !== value) throw new Error(`ALLOW_NEGATIVE_STOCK not applied: ${back.data?.ALLOW_NEGATIVE_STOCK}`)
}

// ---------------------------------------------------------------- C1
async function c1 () {
  const off = logOffset()
  const prod = await newProduct(G.owner, { stock: 20000, tag: 'C1' })
  const cust = await newCustomer(G.owner, 'C1')
  const all = []; const refs = []
  for (let wave = 1; wave <= 3; wave++) {
    const jobs = []
    G.cashiers.forEach((u, i) => {
      const qty = 1 + (i % 3); const ref = uuid(); refs.push({ ref, qty })
      const body = saleBody({ productId: prod.id, qty, price: 10, ref, customerId: i % 2 === 0 ? cust.id : null, payments: i % 2 === 0 ? undefined : [{ method: 'Cash', amount: qty * 10.5 }] })
      jobs.push(() => call(u, 'POST', '/api/sales', body))
      if (wave === 3) jobs.push(() => call(u, 'POST', '/api/sales', body)) // double click: same externalReference
    })
    all.push(...await allAtOnce(jobs))
  }
  const saved = sql(`select "ExternalReference", count(*) from "Sales" where "ExternalReference" in (${refs.map((r) => `'${r.ref}'`).join(',')}) group by 1`)
  const dupRefs = saved.filter((r) => r[1] !== '1').length
  const qtySold = refs.filter((r) => saved.some((s) => s[0] === r.ref)).reduce((a, r) => a + r.qty, 0)
  const stock = num(sql1(`select "StockQty" from "Products" where "Id"=${prod.id}`))
  const checks = [
    noServerErrors(all),
    check('every save succeeded (200/201)', all.every((r) => [200, 201].includes(r.status)), JSON.stringify(summarize(all).statuses)),
    check('double-click (same externalReference) saved once', dupRefs === 0 && saved.length === refs.length, `distinct saved=${saved.length}/${refs.length} refs with >1 row=${dupRefs}`),
    check('stock = 20000 - qty of saved invoices', stock === 20000 - qtySold, `stock=${stock} expected=${20000 - qtySold}`),
    ...invariants(T), ...await ledgerCheck(G.owner, cust.id), ...logChecks(off),
  ]
  return { res: all, checks }
}

// ---------------------------------------------------------------- C2
async function c2 () {
  const off = logOffset()
  const prod = await newProduct(G.owner, { stock: 1000, tag: 'C2' })
  const cust = await newCustomer(G.owner, 'C2')
  const sale = await call(G.owner, 'POST', '/api/sales', saleBody({ productId: prod.id, qty: 100, price: 10, customerId: cust.id })) // 1050 incl. VAT
  if (sale.status !== 201) throw new Error(`setup sale ${sale.status}`)
  const total = sale.data.grandTotal
  const users = G.admins.slice(0, 10)
  const jobs = []; let expected = 0
  users.forEach((u, i) => {
    const key = uuid(); const amount = 10 + i; expected += amount
    const body = { customerId: cust.id, amount, mode: 'CASH', reference: `c2-${i}`, ...(i % 2 === 0 ? { saleId: sale.data.id } : {}) }
    jobs.push(() => call(u, 'POST', '/api/payments', body, { 'Idempotency-Key': key }))
    jobs.push(() => call(u, 'POST', '/api/payments', body, { 'Idempotency-Key': key })) // double click
  })
  const res = await allAtOnce(jobs)
  const rows = sql(`select "Id","Amount","Reference" from "Payments" where "CustomerId"=${cust.id} and "Status"='CLEARED'`)
  const sum = rows.reduce((a, r) => a + num(r[1]), 0)
  const bal = num(sql1(`select "Balance" from "Customers" where "Id"=${cust.id}`))
  const paid = num(sql1(`select "PaidAmount" from "Sales" where "Id"=${sale.data.id}`))
  const onSale = num(sql1(`select coalesce(sum("Amount"),0) from "Payments" where "SaleId"=${sale.data.id} and "Status"='CLEARED'`))
  const idem = sql1(`select count(*) from "PaymentIdempotencies" where "PaymentId" in (select "Id" from "Payments" where "CustomerId"=${cust.id})`)
  const checks = [
    noServerErrors(res),
    check('exactly 10 payment rows (no duplicates from double click)', rows.length === 10, `rows=${rows.length} statuses=${JSON.stringify(summarize(res).statuses)}`),
    check('payments total exact', Math.abs(sum - expected) < 0.005, `sum=${sum} expected=${expected}`),
    check('customer balance exact', Math.abs(bal - (total - expected)) < 0.005, `balance=${bal} expected=${total - expected}`),
    check('invoice PaidAmount = payments attached to it and <= total', paid <= total && Math.abs(paid - onSale) < 0.005, `paid=${paid} attached=${onSale} total=${total}`),
    check('one idempotency record per payment', idem === '10', `idempotency rows=${idem}`),
    ...invariants(T), ...await ledgerCheck(G.owner, cust.id), ...logChecks(off),
  ]
  return { res, checks }
}

// ---------------------------------------------------------------- C3
async function c3 () {
  const off = logOffset(); const res = []; const checks = []
  try {
    for (const [allow, expectOk] of [['false', 5], ['true', 10]]) {
      await setNegStock(allow)
      const prod = await newProduct(G.owner, { stock: 5, tag: 'C3' })
      const r = await allAtOnce(G.cashiers.slice(0, 10).map((u) => () => call(u, 'POST', '/api/sales', saleBody({ productId: prod.id, qty: 1, price: 10 }))))
      res.push(...r)
      const ok = r.filter((x) => x.status === 201).length
      const stock = num(sql1(`select "StockQty" from "Products" where "Id"=${prod.id}`))
      const txn = num(sql1(`select coalesce(sum("ChangeQty"),0) from "InventoryTransactions" where "ProductId"=${prod.id}`))
      checks.push(check(`ALLOW_NEGATIVE_STOCK=${allow}: ${expectOk} of 10 sales accepted`, ok === expectOk, `accepted=${ok} statuses=${JSON.stringify(summarize(r).statuses)}`))
      checks.push(check(`ALLOW_NEGATIVE_STOCK=${allow}: final stock correct`, stock === 5 - ok && (allow === 'true' || stock >= 0), `stock=${stock} expected=${5 - ok}`))
      checks.push(check(`ALLOW_NEGATIVE_STOCK=${allow}: stock = inventory transactions`, stock === txn, `stock=${stock} txn=${txn}`))
      checks.push(check(`ALLOW_NEGATIVE_STOCK=${allow}: rejections are clean 4xx`, r.every((x) => x.status === 201 || (x.status >= 400 && x.status < 500)), JSON.stringify(summarize(r).statuses)))
    }
  } finally { await setNegStock('true') }
  checks.push(noServerErrors(res), ...invariants(T), ...logChecks(off))
  return { res, checks }
}

// ---------------------------------------------------------------- C6
let dayCounter = 0
async function c6 () {
  const off = logOffset(); const res = []; const checks = []
  const branchId = num(sql1(`select "Id" from "Branches" where "Name"='T5 Branch' and "TenantId"=${T}`))
  const base = Date.UTC(2026, 0, 1) + (Date.now() % 200) * 86400000 + (dayCounter++) * 86400000 * 2
  for (const [label, br] of [['no branch', null], ['branch', branchId]]) {
    const date = new Date(base + (br ? 86400000 : 0)).toISOString().slice(0, 10)
    const body = { businessDate: date, ...(br ? { branchId: br } : {}), openingCash: 100, countedCash: 100, comment: `c6 ${label}`, submitClose: true }
    const r = await allAtOnce([() => call(G.owner, 'POST', '/api/daily-close', body), () => call(G.admins[0], 'POST', '/api/daily-close', body)])
    res.push(...r)
    const where = `"TenantId"=${T} and "BusinessDate"::date='${date}' and ${br ? `"BranchId"=${br}` : '"BranchId" is null'}`
    const closed = sql1(`select count(*) from "DailyCashCloses" where ${where} and "Status" ilike 'closed'`)
    const rows = sql1(`select count(*) from "DailyCashCloses" where ${where}`)
    checks.push(check(`close ${label} ${date}: exactly one Closed row`, closed === '1', `closed rows=${closed} total rows=${rows} http=${r.map((x) => x.status)}`))
    checks.push(check(`close ${label} ${date}: loser gets a clean 4xx or the same row (no 500)`, r.every((x) => x.status === 200 || (x.status >= 400 && x.status < 500)), `http=${r.map((x) => x.status)} msgs=${r.map((x) => (x.json?.message || '').slice(0, 60)).join(' | ')}`))
  }
  checks.push(noServerErrors(res), ...logChecks(off))
  return { res, checks }
}

// ---------------------------------------------------------------- C7
async function c7 () {
  const off = logOffset()
  const cust = await newCustomer(G.owner, 'C7')
  const prod = await newProduct(G.owner, { stock: 50000, tag: 'C7' })
  for (let k = 0; k < 300; k += 15) { // build ledger volume (300 invoices on one customer) in 15-wide batches
    await allAtOnce(G.cashiers.map((u) => () => call(u, 'POST', '/api/sales', saleBody({ productId: prod.id, qty: 1, price: 10, customerId: cust.id }))))
  }
  const from = '2026-10-01'; const to = '2026-12-31'
  const eps = {
    customerLedger: `/api/customers/${cust.id}/ledger`,
    salesLedger: `/api/reports/sales-ledger?fromDate=${from}&toDate=${to}`,
    reportSummary: `/api/reports/summary?fromDate=${from}&toDate=${to}`,
    reportOutstanding: '/api/reports/outstanding',
    vat: '/api/reports/vat-return?from=2026-11-01&to=2027-01-31',
  }
  const per = {}; const all = []
  const names = Object.keys(eps)
  // Solo baseline: each endpoint alone, 5 sequential calls (separates "slow endpoint" from "does not scale").
  const solo = {}
  for (const n of names) { const l = []; for (let k = 0; k < 5; k++) l.push(await call(G.admins[0], 'GET', eps[n])); solo[n] = summarize(l) }
  // C7a (budget test): 15 users at the same moment, each opens ONE page (5 endpoints rotated over users), 3 rounds.
  for (let round = 0; round < 3; round++) {
    all.push(...await allAtOnce(G.admins.map((u, i) => async () => { const n = names[(i + round) % names.length]; const r = await call(u, 'GET', eps[n]); (per[n] ||= []).push(r); return r })))
  }
  // C7b (stress): the same 15 users each fire all 5 endpoints together (75 in flight), 3 rounds.
  const stress = []
  for (let round = 0; round < 3; round++) {
    stress.push(...await allAtOnce(G.admins.flatMap((u) => names.map((n) => () => call(u, 'GET', eps[n])))))
  }
  all.push(...stress)
  const checks = [noServerErrors(all), ...logChecks(off)]
  const budget = 1000
  for (const [name, list] of Object.entries(per)) {
    const s = summarize(list)
    checks.push(check(`C7a ${name}: all 200 and p95 <= ${budget} ms (budget s2 first-data-row, API proxy); solo p50=${solo[name].p50}`, list.every((r) => r.status === 200) && s.p95 <= budget, `n=${s.n} p50=${s.p50} p95=${s.p95} max=${s.max} solo_p50=${solo[name].p50} statuses=${JSON.stringify(s.statuses)}`))
  }
  const ss = summarize(stress)
  checks.push(check('C7b stress (75 in flight): all 200, no timeouts', stress.every((r) => r.status === 200), `n=${ss.n} p50=${ss.p50} p95=${ss.p95} max=${ss.max} statuses=${JSON.stringify(ss.statuses)}`))
  checks.push(...await ledgerCheck(G.owner, cust.id))
  return { res: all, checks, per: { ...Object.fromEntries(Object.entries(per).map(([k, v]) => [k, summarize(v)])), solo, stress: ss } }
}

// ---------------------------------------------------------------- C5
async function c5 () {
  const off = logOffset()
  const prod = await newProduct(G.owner, { stock: 1000, tag: 'C5' })
  const cust = await newCustomer(G.owner, 'C5')
  const invs = []
  for (let i = 0; i < 3; i++) invs.push((await call(G.owner, 'POST', '/api/sales', saleBody({ productId: prod.id, qty: 10, price: 10, customerId: cust.id }))).data) // 105 each
  const jobs = []
  G.admins.slice(0, 4).forEach((u) => jobs.push(() => call(u, 'POST', '/api/payments/allocate', { customerId: cust.id, amount: 120, mode: 'CASH', allocations: [{ invoiceId: invs[0].id, amount: 60 }, { invoiceId: invs[1].id, amount: 60 }] }, { 'Idempotency-Key': uuid() })))
  G.admins.slice(4, 8).forEach((u) => jobs.push(() => call(u, 'POST', '/api/payments', { saleId: invs[0].id, customerId: cust.id, amount: 60, mode: 'CASH' }, { 'Idempotency-Key': uuid() })))
  G.admins.slice(8, 12).forEach((u) => jobs.push(() => call(u, 'POST', '/api/payments', { saleId: invs[1].id, customerId: cust.id, amount: 60, mode: 'CASH' }, { 'Idempotency-Key': uuid() })))
  const res = await allAtOnce(jobs)
  const per = invs.map((s) => sql(`select s."GrandTotal", s."PaidAmount", coalesce((select sum("Amount") from "Payments" p where p."SaleId"=s."Id" and p."Status"='CLEARED'),0), s."PaymentStatus" from "Sales" s where s."Id"=${s.id}`)[0].map((v, i) => (i < 3 ? num(v) : v)))
  const checks = [
    noServerErrors(res, 'no 5xx / network errors (rejections must be 4xx)'),
    ...per.map((p, i) => check(`invoice ${i + 1}: payments <= invoice total and PaidAmount matches`, p[2] <= p[0] + 0.005 && p[1] <= p[0] + 0.005 && Math.abs(p[1] - p[2]) < 0.005, `total=${p[0]} paidAmount=${p[1]} sumPayments=${p[2]} status=${p[3]}`)),
    check('accepted vs rejected recorded', true, `statuses=${JSON.stringify(summarize(res).statuses)}`),
    ...invariants(T), ...await ledgerCheck(G.owner, cust.id), ...logChecks(off),
  ]
  return { res, checks }
}

// ---------------------------------------------------------------- C8
async function c8 () {
  const off = logOffset(); const checks = []
  const A = G; const B = F
  const mk = async (t, tag) => ({ prod: await newProduct(t.owner, { stock: 500, tag }), cust: await newCustomer(t.owner, tag) })
  const a = await mk(A, 'C8A'); const b = await mk(B, 'C8B')
  await call(A.owner, 'POST', '/api/sales', saleBody({ productId: a.prod.id, qty: 2, customerId: a.cust.id }))
  await call(B.owner, 'POST', '/api/sales', saleBody({ productId: b.prod.id, qty: 2, customerId: b.cust.id }))
  const users = [...A.cashiers.slice(0, 7).map((u) => ({ u, t: A, x: a })), ...B.cashiers.slice(0, 8).map((u) => ({ u, t: B, x: b }))] // 15 mixed users
  const bodies = []
  const idSets = { A: { customers: [], products: [], sales: [], payments: [] }, B: { customers: [], products: [], sales: [], payments: [] } }
  const walk = async ({ u, t, x }) => {
    const side = t === A ? 'A' : 'B'
    const gets = [['customers', '/api/customers?page=1&pageSize=100'], ['products', '/api/products?page=1&pageSize=100'], ['sales', '/api/sales?page=1&pageSize=100'], ['payments', '/api/payments?page=1&pageSize=100'], [null, `/api/customers/${x.cust.id}/ledger`], [null, '/api/reports/sales-ledger?fromDate=2026-10-01&toDate=2026-12-31'], [null, '/api/settings'], ['owner', '/api/users'], [null, '/api/reports/summary?fromDate=2026-10-01&toDate=2026-12-31'], [null, '/api/customers/pending-summary']]
    const out = []
    for (const [kind, ep] of gets) {
      const r = await call(kind === 'owner' ? t.owner : u, 'GET', ep); out.push(r); bodies.push({ side, ep, text: JSON.stringify(r.json) })
      if (kind && kind !== 'owner') { const items = r.data?.items || r.data?.Items || (Array.isArray(r.data) ? r.data : []); idSets[side][kind].push(...items.map((i) => i.id).filter((n) => n > 0)) }
    }
    out.push(await call(u, 'POST', '/api/sales', saleBody({ productId: x.prod.id, qty: 1, customerId: x.cust.id })))
    return out
  }
  const res = (await allAtOnce(users.map((usr) => () => walk(usr)))).flat()
  const notOk = res.filter((r) => r.status < 200 || r.status >= 300)
  checks.push(noServerErrors(res), check('all reads/writes 2xx for own tenant', notOk.length === 0, `non-2xx=${notOk.length} ${JSON.stringify(summarize(res).statuses)}`))
  // 1. the other tenant's markers must never appear in a response
  const leaks = bodies.filter((x) => (x.side === 'A' && /frozenhub1/i.test(x.text)) || (x.side === 'B' && /gulfharvest/i.test(x.text)))
  checks.push(check('zero cross-tenant markers (tenant slugs/company names) in any response body', leaks.length === 0, `responses checked=${bodies.length} leaking=${leaks.length} ${[...new Set(leaks.map((l) => l.ep))].slice(0, 4).join(',')}`))
  // 2. every returned row id belongs to the caller's tenant in the DB
  let rowsChecked = 0; const bad = []
  for (const [side, tid] of [['A', A.tenantId], ['B', B.tenantId]]) {
    for (const [kind, table] of [['customers', 'Customers'], ['products', 'Products'], ['sales', 'Sales'], ['payments', 'Payments']]) {
      const list = [...new Set(idSets[side][kind])]; rowsChecked += list.length
      if (!list.length) continue
      const n = sql1(`select count(*) from "${table}" where "Id" in (${list.join(',')}) and "TenantId" is distinct from ${tid}`)
      if (n !== '0') bad.push(`${side}.${kind}:${n}`)
    }
  }
  checks.push(check('every id in list responses belongs to the caller tenant (DB check)', bad.length === 0 && rowsChecked > 0, `ids checked=${rowsChecked} wrong-tenant=${bad.join(',') || 0}`))
  // 3. direct access to the other tenant's entities with own token
  const sA = A.cashiers[0]; const sB = B.cashiers[0]
  const bSale = num(sql1(`select max("Id") from "Sales" where "TenantId"=${B.tenantId}`)); const aSale = num(sql1(`select max("Id") from "Sales" where "TenantId"=${A.tenantId}`))
  const probes = [[sA, `/api/customers/${b.cust.id}`], [sA, `/api/customers/${b.cust.id}/ledger`], [sA, `/api/products/${b.prod.id}`], [sA, `/api/sales/${bSale}`], [sB, `/api/customers/${a.cust.id}`], [sB, `/api/customers/${a.cust.id}/ledger`], [sB, `/api/products/${a.prod.id}`], [sB, `/api/sales/${aSale}`]]
  const pr = []
  for (const [s, ep] of probes) { const r = await call(s, 'GET', ep); pr.push({ ep, status: r.status, leaked: r.status === 200 && r.data != null && (Array.isArray(r.data) ? r.data.length > 0 : true) }) }
  checks.push(check("direct GET of the other tenant's ids returns no data (404/403/empty)", pr.every((p) => !p.leaked), JSON.stringify(pr)))
  // 4. A's token presented with B's host
  const spoof = await call({ ...sA, slug: 'frozenhub1-test' }, 'GET', '/api/customers?page=1&pageSize=100')
  const spoofIds = (spoof.data?.items || spoof.data?.Items || []).map((i) => i.id)
  const spoofWrong = spoofIds.length ? sql1(`select count(*) from "Customers" where "Id" in (${spoofIds.join(',')}) and "TenantId"<>${A.tenantId}`) : '0'
  checks.push(check('tenant A token on tenant B host: rejected or A-only rows', spoof.status >= 400 || spoofWrong === '0', `http=${spoof.status} rows=${spoofIds.length} foreign=${spoofWrong}`))
  checks.push(...invariants(A.tenantId), ...invariants(B.tenantId), ...logChecks(off))
  return { res, checks }
}

// ---------------------------------------------------------------- C9
async function c9 () {
  const off = logOffset(); const checks = []; const all = []
  const sessions = G.admins
  const hit = (s, ep = '/api/auth/validate') => call(s, 'GET', ep)
  // Phase 1: valid tokens, 15 users x 6 parallel requests
  const p1 = await allAtOnce(sessions.flatMap((s) => Array.from({ length: 6 }, () => () => hit(s))))
  all.push(...p1)
  checks.push(check('validate storm with valid tokens: all 200', p1.every((r) => r.status === 200), JSON.stringify(summarize(p1).statuses)))
  // Phase 2: all 15 tokens become unusable at once. The API has no refresh endpoint, so a tampered signature models expiry.
  const dead = sessions.map((s) => ({ ...s, token: s.token.slice(0, -4) + (s.token.endsWith('AAAA') ? 'BBBB' : 'AAAA') }))
  const p2 = await allAtOnce(dead.flatMap((s) => Array.from({ length: 6 }, (_, k) => () => hit(s, k % 2 ? '/api/auth/validate' : '/api/customers?page=1&pageSize=20'))))
  all.push(...p2)
  checks.push(check('dead-token storm: every request is a clean 401 (no 500, no 200, no 403/429 cascade)', p2.every((r) => r.status === 401), JSON.stringify(summarize(p2).statuses)))
  // Phase 3: all sessions sign in again at the same time (what the app does after a 401), then resume
  const re = await allAtOnce(sessions.map((s) => () => login(s.slug, s.email).catch((e) => ({ err: String(e.message) }))))
  checks.push(check('simultaneous re-login of 15 sessions: all succeed (no 429/500 lockout)', re.every((r) => r.token), `ok=${re.filter((r) => r.token).length}/15 ${re.filter((r) => !r.token).slice(0, 2).map((r) => r.err).join(' ')}`))
  const fresh = re.filter((r) => r.token)
  const p3 = await allAtOnce(fresh.flatMap((s) => Array.from({ length: 4 }, () => () => hit(s, '/api/customers?page=1&pageSize=20'))))
  all.push(...p3)
  checks.push(check('after re-login: all requests 200 (no 401 loop)', p3.length > 0 && p3.every((r) => r.status === 200), JSON.stringify(summarize(p3).statuses)))
  // Phase 4: old token after a newer login by the same user (informational: session policy)
  const old = await hit(sessions[0]); checks.push(check('info: pre-existing token still accepted after a newer login (multi-device)', true, `http=${old.status}`))
  checks.push(noServerErrors(all), ...logChecks(off))
  return { res: all, checks }
}

const SCEN = { c1, c2, c3, c5, c6, c7, c8, c9 }
const NAMES = { c1: 'C1 15 cashiers save POS invoices at once', c2: 'C2 10 users pay the same customer (+double click)', c3: 'C3 10 sales of one low-stock product', c5: 'C5 bulk allocation + single payments on same invoices', c6: 'C6 2 users submit the same daily close', c7: 'C7 15 users load ledgers/reports/VAT', c8: 'C8 two tenants, 15 mixed users', c9: 'C9 token expiry storm' }
const results = []
for (const id of Object.keys(SCEN).filter((k) => WANT.includes(k))) {
  const runs = []
  for (let run = 1; run <= RUNS; run++) {
    const t0 = Date.now()
    custFloor = num(sql1('select coalesce(max("Id"),0) from "Customers"'))
    try {
      const r = await SCEN[id]()
      const s = summarize(r.res)
      runs.push({ run, ...s, perEndpoint: r.per, errorRate: r2((s.serverErrors / Math.max(1, s.n)) * 100), seconds: r2((Date.now() - t0) / 1000), checks: r.checks })
    } catch (e) { runs.push({ run, crashed: String(e.stack || e).slice(0, 600), checks: [check('scenario ran', false, String(e.message))] }) }
    const last = runs.at(-1)
    console.log(`${id} run ${run}: n=${last.n} p50=${last.p50} p95=${last.p95} 5xx=${last.serverErrors} checks ${last.checks.filter((c) => c.pass).length}/${last.checks.length}`)
    for (const c of last.checks.filter((c) => !c.pass)) console.log(`   FAIL ${c.name}: ${c.detail}`)
  }
  results.push({ id, name: NAMES[id], runs })
}
const file = path.join(OUT, `raw-${WANT.join('-')}.json`)
fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), runsPerScenario: RUNS, results }, null, 1))
console.log('raw results:', file)
process.exit(results.some((r) => r.runs.some((x) => x.checks.some((c) => !c.pass))) ? 1 : 0)
