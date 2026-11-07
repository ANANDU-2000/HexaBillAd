// Per-route and total gzip JS sizes from dist/assets (no extra dependency, no node_modules writes).
// Run after `npm run build`:  node scripts/bundle-size.mjs
// Writes docs/uiux/evidence/2026-11-07/perf/bundle.json (same shape the Playwright perf specs write)
// so `npm run perf` merges it into the baseline table.
//
// Route chunk -> file: every `lazy(() => import('../x/Name'))` in src/app/App.jsx becomes `Name-<hash>.js`.
// "Route JS" = the route chunk plus the chunks it imports statically that the entry (index) bundle does
// NOT already load. Chunks in the entry's static closure are "shared" and excluded (PERF-AND-E2E-CONTROL §2).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(here, '..')
const repoRoot = path.resolve(uiRoot, '..', '..')
const dist = path.join(uiRoot, 'dist')
const assets = path.join(dist, 'assets')
const outDir = path.join(repoRoot, 'docs', 'uiux', 'evidence', '2026-11-07', 'perf')

if (!fs.existsSync(assets)) {
  console.error('dist/assets not found. Run `npm run build` first.')
  process.exit(2)
}

const files = fs.readdirSync(assets).filter((f) => f.endsWith('.js'))
const gz = new Map()
const text = new Map()
for (const f of files) {
  const buf = fs.readFileSync(path.join(assets, f))
  text.set(f, buf.toString('utf8'))
  gz.set(f, zlib.gzipSync(buf, { level: 9 }).length)
}

// Static imports only: `from"./X.js"` and bare `import"./X.js"`. `import("./X.js")` is dynamic and excluded.
function staticDeps (file) {
  const src = text.get(file)
  const deps = new Set()
  for (const m of src.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
    if (text.has(m[1]) && m[1] !== file) deps.add(m[1])
  }
  return deps
}
function closure (start) {
  const seen = new Set()
  const stack = [start]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    for (const d of staticDeps(f)) stack.push(d)
  }
  return seen
}

// Entry = the module script in dist/index.html.
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/)
if (!entryMatch) {
  console.error('Could not find the entry module script in dist/index.html')
  process.exit(2)
}
const entry = entryMatch[1]
const shared = closure(entry)

const app = fs.readFileSync(path.join(uiRoot, 'src', 'app', 'App.jsx'), 'utf8')
const routes = new Map() // chunk base name -> App.jsx import path
for (const m of app.matchAll(/lazy\(\(\)\s*=>\s*import\('([^']+)'\)/g)) {
  const base = m[1].split('/').pop()
  routes.set(base, m[1])
}

const kb = (n) => Math.round((n / 1024) * 10) / 10
const rows = []
for (const [name] of routes) {
  const own = files.find((f) => f.startsWith(`${name}-`) && /-[A-Za-z0-9_-]{8}\.js$/.test(f))
  if (!own) continue
  const all = closure(own)
  let deps = 0
  const depList = []
  for (const f of all) {
    if (f === own || shared.has(f)) continue
    deps += gz.get(f)
    depList.push(`${f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '')}:${kb(gz.get(f))}`)
  }
  rows.push({ route: name, own: gz.get(own), deps, total: gz.get(own) + deps, depList })
}
rows.sort((a, b) => b.total - a.total)

let totalAll = 0
for (const f of files) totalAll += gz.get(f)
let entryClosure = 0
for (const f of shared) entryClosure += gz.get(f)

console.log(`Entry: ${entry}  (shared static closure ${shared.size} chunks, ${kb(entryClosure)} kB gzip)`)
console.log(`All JS chunks: ${files.length}, ${kb(totalAll)} kB gzip\n`)
console.log('Route'.padEnd(34) + 'own kB'.padStart(9) + 'deps kB'.padStart(9) + 'total kB'.padStart(10) + '  budget(120)')
for (const r of rows) {
  console.log(r.route.padEnd(34) + String(kb(r.own)).padStart(9) + String(kb(r.deps)).padStart(9) + String(kb(r.total)).padStart(10) + (kb(r.total) > 120 ? '  OVER' : '  ok'))
}

const PAGES = {
  pos: 'PosPage',
  ledger: 'CustomerLedgerPage',
  salesLedger: 'SalesLedgerPage',
  billingHistory: 'BillingHistoryPage',
  reports: 'ReportsPage',
  dashboard: 'DashboardTally',
}
const metrics = { totalJsGzipKb: kb(totalAll), entryClosureGzipKb: kb(entryClosure) }
const detail = {}
for (const [page, chunk] of Object.entries(PAGES)) {
  const r = rows.find((x) => x.route === chunk)
  if (!r) continue
  metrics[`${page}.routeJsGzipKb`] = kb(r.total)
  detail[page] = { chunk, ownKb: kb(r.own), depsKb: kb(r.deps), deps: r.depList }
}
for (const r of rows) detail[r.route] = detail[r.route] || { chunk: r.route, ownKb: kb(r.own), depsKb: kb(r.deps), deps: r.depList }

fs.mkdirSync(outDir, { recursive: true })
const out = {
  kind: 'bundle',
  profile: 'build',
  generatedAt: new Date().toISOString(),
  note: 'gzip -9 of dist/assets/*.js via node zlib; route JS = route chunk + static deps not in the entry closure',
  metrics,
  detail,
}
fs.writeFileSync(path.join(outDir, 'bundle.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`\nWrote ${path.relative(repoRoot, path.join(outDir, 'bundle.json'))}`)
