#!/usr/bin/env node
// UX-H03 money snapshot. Reads Sales Ledger, Customer Ledger (3 H03 customers), VAT Return and Worksheet for one fixed,
// closed period from the same API endpoints the UI uses, and writes a canonical JSON file plus SHA-256 hashes.
//
//   node scripts/money-snapshot.mjs --label before                 write docs/uiux/evidence/2026-11-08/money-snapshot/before.{json,sha256}
//   node scripts/money-snapshot.mjs --label after --compare before  write after.*, then exit 1 on ANY difference vs before.json
//
// Synthetic local tenant only (HEXABILL_E2E_SLUG, default gulfharvest-test). Fixtures are created once, through the API,
// with fixed amounts and invoice dates inside the period; later runs reuse them and create nothing.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../../..')
const OUT_DIR = path.join(ROOT, 'docs/uiux/evidence/2026-11-08/money-snapshot')

const API = process.env.HEXABILL_API || 'http://127.0.0.1:5000'
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET
const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest-test'
const EMAIL = process.env[`HEXABILL_E2E_EMAIL_${SLUG.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`] || `owner@${SLUG}.hexabill.local`
const PERIOD = { from: '2026-10-01', to: '2026-10-31' } // closed past period; nothing else in the suite dates into it
const VAT_PERIOD = { from: '2026-08-01', to: '2026-10-31' }
const FIXTURE_TAG = 'H03 snapshot'

const args = process.argv.slice(2)
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const label = argOf('--label')
const compare = argOf('--compare')
if (!label || !/^[a-z0-9-]+$/.test(label)) { console.error('usage: money-snapshot.mjs --label <name> [--compare <name>]'); process.exit(2) }
if (!EDGE) { console.error('HEXABILL_EDGE_PROXY_SECRET must be set (the wrapper sets it).'); process.exit(2) }

function ownerPassword () {
  if (process.env.HEXABILL_OWNER_PASSWORD) return process.env.HEXABILL_OWNER_PASSWORD
  const file = path.join(here, '../e2e/.env.local')
  if (fs.existsSync(file)) {
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('HEXABILL_OWNER_PASSWORD='))
    if (line) return line.slice('HEXABILL_OWNER_PASSWORD='.length).trim()
  }
  throw new Error('HEXABILL_OWNER_PASSWORD is not set')
}

let session = null
async function login () {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
    body: JSON.stringify({ email: EMAIL, password: ownerPassword() }),
  })
  const json = await res.json().catch(() => ({}))
  const token = json?.data?.token || json?.data?.Token
  if (!res.ok || !token) throw new Error(`login failed (${res.status})`)
  session = token
}

async function api (method, url, body, key) {
  if (!session) await login()
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (res.status >= 300) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json).slice(0, 240)}`)
  return json.data
}

const rows = (d) => d?.items || d?.Items || (Array.isArray(d) ? d : [])
const r2 = (n) => Math.round(Number(n) * 100) / 100

/** Creates the fixed H03 fixtures once. Returns the three customer ids in order A, B, C. */
async function ensureFixtures () {
  const existing = rows(await api('GET', '/api/customers?page=1&pageSize=200')).filter((c) => String(c.name).startsWith(FIXTURE_TAG))
  if (existing.length >= 3) return existing.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3).map((c) => c.id)

  const branches = rows(await api('GET', '/api/branches'))
  let scope = {}
  if (branches.length) {
    const route = rows(await api('GET', '/api/routes')).find((r) => r.branchId === branches[0].id)
    if (route) scope = { branchId: branches[0].id, routeId: route.id }
  }
  const ids = []
  for (const tag of ['A', 'B', 'C']) {
    const c = await api('POST', '/api/customers', { name: `${FIXTURE_TAG} customer ${tag}`, phone: `058${tag.charCodeAt(0)}0000001`, creditLimit: 100000, customerType: 'Credit', ...scope })
    ids.push(c.id)
  }
  const product = await api('POST', '/api/products', { sku: 'H03-SNAP-ITEM', nameEn: `${FIXTURE_TAG} item`, unitType: 'PIECE', conversionToBase: 1, costPrice: 40, sellPrice: 100, stockQty: 0 })
  await api('POST', '/api/purchases', {
    supplierName: `${FIXTURE_TAG} supplier`, invoiceNo: 'H03-PUR-1', purchaseDate: '2026-10-01', paymentType: 'Cash',
    items: [{ productId: product.id, unitType: 'PIECE', qty: 100, unitCost: 40 }],
  }, 'h03-stock-1')
  const sale = (customerId, qty, unitPrice, discount, ref, day) => api('POST', '/api/sales', {
    customerId, items: [{ productId: product.id, unitType: 'PIECE', qty, unitPrice }], discount,
    externalReference: ref, invoiceDate: `2026-10-${day}T00:00:00Z`,
  })
  const s1 = await sale(ids[0], 2, 100, 0, 'h03-sale-1', '15')
  const s2 = await sale(ids[1], 1, 250, 10, 'h03-sale-2', '16')
  await sale(ids[2], 3, 33.33, 0, 'h03-sale-3', '17')
  // Customer A pays 50.00 against sale 1; customer B pays its whole invoice 2.
  await api('POST', '/api/payments', { customerId: ids[0], saleId: s1.id, amount: 50, mode: 'CASH', reference: null, paymentDate: '2026-10-20T00:00:00Z' }, 'h03-pay-1')
  await api('POST', '/api/payments', { customerId: ids[1], saleId: s2.id, amount: r2(s2.grandTotal), mode: 'CASH', reference: null, paymentDate: '2026-10-21T00:00:00Z' }, 'h03-pay-2')
  return ids
}

/** Canonical form: keys sorted, identifiers and volatile fields removed, money rounded, arrays ordered by content. */
const VOLATILE = /^(id|.*Id|createdAt|updatedAt|generatedAt|rowVersion|RowVersion|requestId|traceId|timestamp|elapsedMs|lastUpdated|lastModified|deletedAt)$/
function canon (value) {
  if (Array.isArray(value)) {
    return value.map(canon).map((v) => ({ v, k: JSON.stringify(v) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((x) => x.v)
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE.test(key)) continue
      out[key] = canon(value[key])
    }
    return out
  }
  if (typeof value === 'number') return Number.isFinite(value) ? r2(value) : null
  return value
}
const stringify = (v) => JSON.stringify(v, null, 2) + '\n'
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

async function collect () {
  const ids = await ensureFixtures()
  const q = `fromDate=${PERIOD.from}&toDate=${PERIOD.to}`
  const sections = {}
  sections.salesLedger = await api('GET', `/api/reports/sales-ledger?${q}`)
  sections.customerLedgerA = await api('GET', `/api/customers/${ids[0]}/ledger?${q}`)
  sections.customerLedgerB = await api('GET', `/api/customers/${ids[1]}/ledger?${q}`)
  sections.customerLedgerC = await api('GET', `/api/customers/${ids[2]}/ledger?${q}`)
  // VAT returns only accept a full quarter (Aug-Oct is a quarter); it contains the whole fixed period.
  sections.vatReturn = await api('GET', `/api/reports/vat-return?from=${VAT_PERIOD.from}&to=${VAT_PERIOD.to}`)
  sections.worksheet = await api('GET', `/api/reports/worksheet?${q}`)
  const canonical = {}
  const hashes = {}
  for (const name of Object.keys(sections)) {
    canonical[name] = canon(sections[name])
    hashes[name] = sha(stringify(canonical[name]))
  }
  const overall = sha(Object.keys(hashes).map((n) => `${n}:${hashes[n]}`).join('\n') + '\n')
  return { period: PERIOD, sections: canonical, sectionSha256: hashes, overallSha256: overall }
}

function diffSections (a, b) {
  const names = [...new Set([...Object.keys(a.sectionSha256), ...Object.keys(b.sectionSha256)])]
  return names.map((n) => ({ section: n, before: b.sectionSha256[n] || '(missing)', after: a.sectionSha256[n] || '(missing)', same: a.sectionSha256[n] === b.sectionSha256[n] }))
}

const snap = await collect()
fs.mkdirSync(OUT_DIR, { recursive: true })
const jsonPath = path.join(OUT_DIR, `${label}.json`)
fs.writeFileSync(jsonPath, stringify({ label, ...snap }))
const hashLines = [`${snap.overallSha256}  ${label}.json  (overall)`, ...Object.entries(snap.sectionSha256).map(([n, h]) => `${h}  ${label}.json#${n}`)]
fs.writeFileSync(path.join(OUT_DIR, `${label}.sha256`), hashLines.join('\n') + '\n')
console.log(`money snapshot ${label}: overall sha256 ${snap.overallSha256}`)
for (const [n, h] of Object.entries(snap.sectionSha256)) console.log(`  ${n.padEnd(18)} ${h}`)

if (compare) {
  const beforePath = path.join(OUT_DIR, `${compare}.json`)
  if (!fs.existsSync(beforePath)) { console.error(`no ${compare}.json to compare with`); process.exit(2) }
  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'))
  const rows2 = diffSections(snap, before)
  const differing = rows2.filter((r) => !r.same)
  console.log(`compare ${label} vs ${compare}:`)
  for (const r of rows2) console.log(`  ${r.same ? 'SAME' : 'DIFF'}  ${r.section}`)
  if (before.overallSha256 !== snap.overallSha256 || differing.length) {
    console.error(`MONEY SNAPSHOT DIFFERS in ${differing.length} section(s)`)
    process.exit(1)
  }
  console.log('MONEY SNAPSHOT SAME')
}
