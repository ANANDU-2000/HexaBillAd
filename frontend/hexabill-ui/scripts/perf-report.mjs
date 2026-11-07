// Merges the JSON written by e2e/perf/*.spec.js and scripts/bundle-size.mjs, prints a table, and
// writes (or compares against) docs/uiux/evidence/2026-11-07/perf/baseline.json.
//
//   node scripts/perf-report.mjs                       print table + write baseline.json
//   node scripts/perf-report.mjs --out other.json      write to another file in the perf dir
//   node scripts/perf-report.mjs --compare baseline.json   no write; exit 1 if any metric regressed > 10 %
//   node scripts/perf-report.mjs --budgets             also exit 1 when a PERF-AND-E2E-CONTROL section 2 budget is exceeded
//
// All metrics are "lower is better". Regression = current > baseline * 1.10 + absolute tolerance
// (25 ms for *Ms, 0.5 kB for *Kb, 2 MB for *Mb, 0 for counts), so sub-50 ms jitter does not fail a run.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..', '..')
const dir = path.join(repoRoot, 'docs', 'uiux', 'evidence', '2026-11-07', 'perf')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }

function loadCurrent () {
  const metrics = {}
  const meta = {}
  if (!fs.existsSync(dir)) return { metrics, meta }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    if (f === 'baseline.json' || f.startsWith('baseline-') || f === opt('--out')) continue
    let j
    try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
    if (!j.metrics) continue
    const profile = j.profile || 'build'
    const page = j.kind === 'bundle' ? 'bundle' : j.page
    for (const [k, v] of Object.entries(j.metrics)) {
      meta[`${profile}.${page}.${k}`] = { file: f, target: j.target }
      if (typeof v === 'number' && Number.isFinite(v)) metrics[`${profile}.${page}.${k}`] = v
    }
  }
  return { metrics, meta }
}

const tol = (name) => (/Ms$|Ms\d*s$/.test(name) ? 25 : /Kb$/.test(name) ? 0.5 : /Mb\d*s$|Mb$/.test(name) ? 2 : 0)
const unit = (name) => (/Ms$/.test(name) ? 'ms' : /Kb$/.test(name) ? 'kB' : /Mb\d*s$/.test(name) ? 'MB' : '')

// Budgets from PERF-AND-E2E-CONTROL.md section 2: [desktop, phone]
const BUDGETS = [
  [/\.routeJsGzipKb$/, [120, 120]],
  [/^(desktop|phone)\.(ledger|salesLedger|billingHistory)(Scaled)?\.firstDataRowMs$/, [1000, 2500]],
  [/\.pos(Scaled)?\.readyToSearchMs$/, [1200, 3000]],
  [/\.pos(Scaled)?\.keystrokeToListP95Ms$/, [100, 250]],
  [/\.pos(Scaled)?\.addItemToTotalMs$/, [50, 150]],
  [/\.longTasksOver200Interaction$/, [0, 2]],
  [/\.idleApiRequests300s$/, [6, 6]],
  [/\.stillLoadingCancelMissingAt3s$/, [0, 0]],
  [/\.noVisibleLoadingStateAt3s$/, [0, 0]],
]
function budgetFor (key, value) {
  const [profile] = key.split('.')
  for (const [re, [d, p]] of BUDGETS) if (re.test(key)) { const b = profile === 'phone' ? p : d; return { budget: b, over: value > b } }
  return null
}

const { metrics: cur, meta } = loadCurrent()
if (!Object.keys(cur).length) {
  console.error(`No perf results found in ${path.relative(repoRoot, dir)}. Run the Playwright perf specs and scripts/bundle-size.mjs first.`)
  process.exit(2)
}

// ---- table: rows = page.metric, columns = desktop | phone (bundle rows have one value)
const rows = new Map()
for (const [key, v] of Object.entries(cur)) {
  const [profile, page, ...rest] = key.split('.')
  const metric = rest.join('.')
  const rk = `${page}.${metric}`
  if (!rows.has(rk)) rows.set(rk, {})
  rows.get(rk)[profile] = v
}
const fmt = (v) => (v == null ? '-' : String(v))
const w = Math.max(...[...rows.keys()].map((k) => k.length), 10)
console.log(`${'metric'.padEnd(w)}  ${'desktop'.padStart(9)}  ${'phone'.padStart(9)}  ${'build'.padStart(9)}  unit`)
for (const [rk, v] of [...rows.entries()].sort()) {
  console.log(`${rk.padEnd(w)}  ${fmt(v.desktop).padStart(9)}  ${fmt(v.phone).padStart(9)}  ${fmt(v.build).padStart(9)}  ${unit(rk)}`)
}

let exit = 0
const over = Object.entries(cur).map(([k, v]) => [k, v, budgetFor(k, v)]).filter(([, , b]) => b && b.over)
if (over.length) {
  console.log(`\nBudget check (PERF-AND-E2E-CONTROL section 2): ${over.length} metric(s) over budget`)
  for (const [k, v, b] of over) console.log(`  OVER  ${k} = ${v} (budget ${b.budget})`)
  if (flag('--budgets')) exit = 1
} else console.log('\nBudget check: no measured metric is over budget')

const cmp = opt('--compare')
if (cmp) {
  const file = path.isAbsolute(cmp) ? cmp : path.join(dir, cmp)
  if (!fs.existsSync(file)) { console.error(`\nBaseline not found: ${file}`); process.exit(2) }
  const base = JSON.parse(fs.readFileSync(file, 'utf8')).metrics || {}
  const regress = []
  const missing = []
  const improved = []
  for (const [k, b] of Object.entries(base)) {
    if (typeof b !== 'number') continue
    if (!(k in cur)) { missing.push(k); continue }
    const c = cur[k]
    if (c > b * 1.1 + tol(k)) regress.push([k, b, c])
    else if (c < b * 0.9 - tol(k)) improved.push([k, b, c])
  }
  console.log(`\nCompare vs ${path.basename(file)}: ${regress.length} regression(s), ${improved.length} improvement(s), ${missing.length} metric(s) missing in this run`)
  for (const [k, b, c] of regress) console.log(`  REGRESSED  ${k}: ${b} -> ${c}`)
  for (const [k, b, c] of improved) console.log(`  improved   ${k}: ${b} -> ${c}`)
  if (regress.length) exit = 1
} else {
  const out = path.join(dir, opt('--out') || 'baseline.json')
  fs.writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Lower is better. Keys are <profile>.<page>.<metric>; profile desktop = 1440 normal, phone = 360 with 4x CPU + Fast 4G, build = bundle sizes.',
    metrics: Object.fromEntries(Object.entries(cur).sort()),
  }, null, 2) + '\n')
  console.log(`\nWrote ${path.relative(repoRoot, out)} (${Object.keys(cur).length} metrics)`)
}
process.exit(exit)
