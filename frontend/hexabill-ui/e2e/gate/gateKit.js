// Shared helpers for the E2E-G1 gate specs (J1, J2, J3, J4, J11). Synthetic local tenants only.
import { apiLogin, API, EDGE, feOrigin } from '../session.js'

export const SLUG = 'gulfharvest-test'
export const OTHER_SLUG = 'frozenhub1-test'

// The runner only exports the e-mail of gulfharvest-test; every synthetic tenant owner follows one pattern.
for (const s of ['gulfharvest-test', 'frozenhub1-test', 'frozenhub2-test', 'zayogya-test']) {
  const key = `HEXABILL_E2E_EMAIL_${s.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  if (!process.env[key]) process.env[key] = `owner@${s}.hexabill.local`
}

export { apiLogin, API, EDGE, feOrigin }
export { signIn as signInFor } from '../session.js'

/** Raw API call as tenant `slug`. Returns { status, json }. Throws only on network failure. */
export async function call (slug, path, { method = 'GET', body, key, token, headers } = {}) {
  const s = token ? { token } : await apiLogin(slug)
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${slug}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      ...(key ? { 'Idempotency-Key': key } : {}),
      ...(headers || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

export async function must (slug, path, opts) {
  const r = await call(slug, path, opts)
  if (r.status >= 300) throw new Error(`${opts?.method || 'GET'} ${path}: ${r.status} ${JSON.stringify(r.json).slice(0, 250)}`)
  return r.json.data
}

export const rows = (d) => d?.items || d?.Items || (Array.isArray(d) ? d : [])
export const r2 = (n) => Math.round(Number(n) * 100) / 100
export const money = (text) => {
  const m = String(text).replace(/,/g, '').match(/-?\d+\.\d{2}/g)
  return m ? Number(m[m.length - 1]) : NaN
}

/** Collects console errors and uncaught page errors (ignores aborted/blocked-by-test noise). */
export function watchConsole (page) {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return errors
}

/** A fresh customer (credit type) with stocked product, created through the real API. Returns { customer, product }. */
export async function freshStocked (slug, tag, { stock = 100, sell = 20, cost = 8, barcode } = {}) {
  const stamp = `${tag}${Date.now()}`
  const branches = rows(await must(slug, '/api/branches'))
  let scope = {}
  if (branches.length) {
    const route = rows(await must(slug, '/api/routes')).find((x) => x.branchId === branches[0].id)
    if (route) scope = { branchId: branches[0].id, routeId: route.id }
  }
  const customer = await must(slug, '/api/customers', {
    method: 'POST',
    body: { name: `G1 ${tag} cust ${stamp}`, phone: `050${stamp.replace(/\D/g, '').slice(-7)}`, creditLimit: 100000, customerType: 'Credit', ...scope },
  })
  const product = await must(slug, '/api/products', {
    method: 'POST',
    body: { sku: `G1-${stamp}`, nameEn: `G1 ${tag} item ${stamp}`, unitType: 'PIECE', conversionToBase: 1, costPrice: cost, sellPrice: sell, stockQty: 0, ...(barcode ? { barcode } : {}) },
  })
  await must(slug, '/api/purchases', {
    method: 'POST', key: `g1-stock-${stamp}`,
    body: { supplierName: `G1 stock ${stamp}`, invoiceNo: `G1S-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash', items: [{ productId: product.id, unitType: 'PIECE', qty: stock, unitCost: cost }] },
  })
  return { customer, product, stamp }
}

export const customerBalance = async (slug, id) => Number((await must(slug, `/api/customers/${id}`)).balance)

/** Creates `n` stocked products (first one gets a barcode) for one fresh credit customer. */
export async function freshCart (slug, tag, prices = [20, 35.5, 12.25]) {
  const { customer, product, stamp } = await freshStocked(slug, tag, { sell: prices[0], barcode: `G1B${Date.now()}`.slice(0, 14) })
  const products = [product]
  for (let i = 1; i < prices.length; i++) {
    const p = await must(slug, '/api/products', {
      method: 'POST',
      body: { sku: `G1-${stamp}-${i}`, nameEn: `G1 ${tag} item${i} ${stamp}`, unitType: 'PIECE', conversionToBase: 1, costPrice: 5, sellPrice: prices[i], stockQty: 0 },
    })
    await must(slug, '/api/purchases', {
      method: 'POST', key: `g1-stock-${stamp}-${i}`,
      body: { supplierName: `G1 stock ${stamp}`, invoiceNo: `G1S-${stamp}-${i}`, purchaseDate: new Date().toISOString().slice(0, 10), paymentType: 'Cash', items: [{ productId: p.id, unitType: 'PIECE', qty: 100, unitCost: 5 }] },
    })
    products.push(p)
  }
  return { customer, products, stamp }
}

/** Trailing integer of an invoice number such as "INV-2026-0042" or "0042". */
export const invoiceSeq = (no) => Number((String(no).match(/(\d+)\D*$/) || [])[1])

/** Opens POS and chooses the customer by typing its name. */
export async function posPickCustomer (page, name) {
  const search = page.getByPlaceholder(/^Customer/).filter({ visible: true }).first()
  await search.click()
  await search.fill(name)
  await page.getByText(name, { exact: true }).filter({ visible: true }).last().click()
}

/** Adds a product from the picker (Add Row on wide layouts, Add Product to Bill on phones). */
export async function posAddByPicker (page, productName) {
  const addRow = page.getByRole('button', { name: 'Add Row', exact: true }).filter({ visible: true })
  const addToBill = page.getByRole('button', { name: 'Add Product to Bill', exact: true }).filter({ visible: true })
  await ((await addRow.count()) > 0 ? addRow : addToBill).first().click()
  await page.getByPlaceholder(/Search name, SKU, barcode/).filter({ visible: true }).first().fill(productName)
  await page.getByRole('button').filter({ hasText: productName }).filter({ visible: true }).first().click()
}

export const isWide = (page) => (page.viewportSize()?.width || 0) >= 768
