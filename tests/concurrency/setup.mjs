// Idempotent fixture setup on the LOCAL synthetic DB: unlimited plan row, 15 Staff users per tenant, helpers.
import { call, login, ownerSession, sql, sql1, PASSWORD, allAtOnce, uuid } from './lib.mjs'

export const TENANT_SLUGS = ['gulfharvest-test', 'frozenhub1-test']
export const USERS_PER_TENANT = 15

export function ensurePlan () {
  // Hand-made rows are inserted by hexabill_qa (the table owner). Local disposable DB only.
  if (sql1('select count(*) from "SubscriptionPlans"') === '0') {
    sql(`insert into "SubscriptionPlans" ("Name","Description","MonthlyPrice","YearlyPrice","Currency","MaxUsers","MaxInvoicesPerMonth","MaxCustomers","MaxProducts","MaxStorageMB","HasAdvancedReports","HasApiAccess","HasWhiteLabel","HasPrioritySupport","HasCustomBranding","TrialDays","IsActive","DisplayOrder","CreatedAt") values ('T5 unlimited (local only)','concurrency test',0,0,'AED',-1,-1,-1,-1,1024,true,true,false,false,false,0,true,1,now())`)
  }
  const planId = sql1(`select "Id" from "SubscriptionPlans" order by "Id" limit 1`)
  for (const slug of TENANT_SLUGS) {
    const tid = sql1(`select "Id" from "Tenants" where "Subdomain"='${slug}'`)
    if (sql1(`select count(*) from "Subscriptions" where "TenantId"=${tid}`) === '0') {
      sql(`insert into "Subscriptions" ("TenantId","PlanId","Status","BillingCycle","StartDate","Amount","Currency","CreatedAt") values (${tid},${planId},1,0,now(),0,'AED',now())`)
    }
  }
}

export async function ensureUsers (slug, owner) {
  const sessions = []
  const have = new Set(sql(`select "Email" from "Users" where "TenantId"=(select "Id" from "Tenants" where "Subdomain"='${slug}')`).map((r) => r[0]))
  for (let i = 1; i <= USERS_PER_TENANT; i++) {
    const email = `cash${i}@${slug}.hexabill.local`
    if (!have.has(email)) {
      const r = await call(owner, 'POST', '/api/users', { name: `Synthetic cashier ${i}`, email, password: PASSWORD, role: 'Staff' })
      if (r.status >= 300) throw new Error(`create user ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
    }
  }
  // Staff need a branch + route before they can invoice (NO_ROUTE_ASSIGNED otherwise).
  const ids = sql(`select "Id" from "Users" where "Email" like 'cash%@${slug}.hexabill.local' order by "Id"`).map((r) => Number(r[0]))
  let branchId = sql1(`select "Id" from "Branches" where "Name"='T5 Branch' and "TenantId"=(select "Id" from "Tenants" where "Subdomain"='${slug}')`)
  if (!branchId) {
    const b = await call(owner, 'POST', '/api/branches', { name: 'T5 Branch', address: 'synthetic', assignedStaffIds: ids })
    if (b.status >= 300) throw new Error(`branch: ${b.status} ${JSON.stringify(b.json).slice(0, 300)}`)
    branchId = b.data.id
  }
  if (!sql1(`select "Id" from "Routes" where "Name"='T5 Route' and "TenantId"=(select "Id" from "Tenants" where "Subdomain"='${slug}')`)) {
    const r = await call(owner, 'POST', '/api/routes', { branchId: Number(branchId), name: 'T5 Route', assignedStaffIds: ids })
    if (r.status >= 300) throw new Error(`route: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)
  }
  const logins = await allAtOnce(Array.from({ length: USERS_PER_TENANT }, (_, k) => () => login(slug, `cash${k + 1}@${slug}.hexabill.local`)))
  sessions.push(...logins)
  return sessions
}

export async function ensureAdmins (slug, owner) {
  const have = new Set(sql(`select "Email" from "Users" where "TenantId"=(select "Id" from "Tenants" where "Subdomain"='${slug}')`).map((r) => r[0]))
  for (let i = 1; i <= USERS_PER_TENANT; i++) {
    const email = `adm${i}@${slug}.hexabill.local`
    if (!have.has(email)) {
      const r = await call(owner, 'POST', '/api/users', { name: `Synthetic admin ${i}`, email, password: PASSWORD, role: 'Admin' })
      if (r.status >= 300) throw new Error(`create admin ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
    }
  }
  return allAtOnce(Array.from({ length: USERS_PER_TENANT }, (_, k) => () => login(slug, `adm${k + 1}@${slug}.hexabill.local`)))
}

export async function getContext () {
  ensurePlan()
  const ctx = {}
  for (const slug of TENANT_SLUGS) {
    const owner = await ownerSession(slug)
    const cashiers = await ensureUsers(slug, owner)
    const admins = await ensureAdmins(slug, owner)
    ctx[slug] = { slug, owner, cashiers, admins, tenantId: Number(owner.tenantId) }
  }
  return ctx
}

let seq = 0
export const stamp = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

/** New product with `stock` units received through a purchase (so InventoryTransactions explain it). */
export async function newProduct (owner, { stock = 1000, price = 10, cost = 5, tag = 'C' } = {}) {
  const s = stamp()
  const p = await call(owner, 'POST', '/api/products', { sku: `${tag}-${s}`, nameEn: `ZZ-T5 ${tag} ${s}`, unitType: 'PCS', conversionToBase: 1, costPrice: cost, sellPrice: price, stockQty: 0 })
  if (p.status >= 300) throw new Error(`product: ${p.status} ${JSON.stringify(p.json).slice(0, 300)}`)
  if (stock > 0) {
    const pu = await call(owner, 'POST', '/api/purchases', { supplierName: `ZZ-T5 supplier ${s}`, invoiceNo: `T5-P-${s}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash', items: [{ productId: p.data.id, unitType: 'PCS', qty: stock, unitCost: cost }] })
    if (pu.status >= 300) throw new Error(`purchase: ${pu.status} ${JSON.stringify(pu.json).slice(0, 300)}`)
  }
  return p.data
}

export async function newCustomer (owner, tag = 'C') {
  const s = stamp()
  const c = await call(owner, 'POST', '/api/customers', { name: `ZZ-T5 ${tag} ${s}`, phone: `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`, creditLimit: 1000000, customerType: 'Credit' })
  if (c.status >= 300) throw new Error(`customer: ${c.status} ${JSON.stringify(c.json).slice(0, 300)}`)
  return c.data
}

export function saleBody ({ productId, qty = 1, price = 10, customerId = null, ref = uuid(), payments }) {
  return { ...(customerId ? { customerId } : {}), externalReference: ref, items: [{ productId, unitType: 'PCS', qty, unitPrice: price }], ...(payments ? { payments } : {}) }
}
