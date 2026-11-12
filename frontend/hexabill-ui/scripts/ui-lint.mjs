#!/usr/bin/env node
// UI design-system guard (DESIGN-SYSTEM-V2.md section 11).
// Ratchet: a file may keep its baseline violations but never add new ones. Lower the baseline as pages are cleaned.
//   node scripts/ui-lint.mjs            check against scripts/ui-lint-baseline.json (exit 1 on any increase)
//   node scripts/ui-lint.mjs --update   rewrite the baseline from the current tree
//   node scripts/ui-lint.mjs --report   print every file with its count, no exit code
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const src = join(root, 'src')
const baselinePath = join(root, 'scripts', 'ui-lint-baseline.json')

// Owner decision 2026-11-12: Dashboard home cards and every POS / billing / invoice-entry screen are NOT restyled.
const PROTECTED = [
  'features/sales/pos/',
  'features/sales/PosPage.jsx',
  'features/sales/PosPageLegacy.jsx',
  'features/sales/BillingHistoryPage.jsx',
  'components/InvoicePreviewModal.jsx',
  'components/PrintOptionsModal.jsx',
]

const RULES = [
  ['colored border-l-4 card', /border-l-4/g],
  ['banned hue (violet/purple/indigo/teal/pink/orange)', /\b(?:bg|text|border|ring|from|to)-(?:violet|purple|indigo|teal|pink|orange)-\d/g],
  ['raw amber-* (use the warning token)', /\b(?:bg|text|border|ring)-amber-\d/g],
  ['text under 12px', /text-\[(?:9|10|11)px\]/g],
  ['tinted KPI/card background (use white + border)', /\bbg-(?:emerald|blue|red|rose|green|sky|cyan|lime|yellow)-(?:50|100)\b/g],
  ['ALL-CAPS label', /\buppercase\b/g],
  ['card shadow (md/lg/xl)', /\bshadow-(?:md|lg|xl)\b/g],
  ['gradient', /\bbg-gradient-/g],
  ['nested scroll area', /\bmax-h-\[|\boverflow-y-auto\b/g],
]

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsx') ? [p] : []
})

const counts = {}
const detail = {}
for (const file of walk(src)) {
  const rel = relative(src, file).split(sep).join('/')
  if (PROTECTED.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)))) continue
  const text = readFileSync(file, 'utf8')
  let total = 0
  for (const [name, re] of RULES) {
    const n = (text.match(re) || []).length
    if (n) { total += n; (detail[rel] ||= {})[name] = n }
  }
  if (total) counts[rel] = total
}

const mode = process.argv[2]
if (mode === '--update') {
  writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2) + '\n')
  console.log(`Baseline written: ${Object.keys(counts).length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} violations.`)
  process.exit(0)
}
if (mode === '--report') {
  for (const [f, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f, JSON.stringify(detail[f]))
  console.log('TOTAL', Object.values(counts).reduce((a, b) => a + b, 0))
  process.exit(0)
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
const failures = []
for (const [f, n] of Object.entries(counts)) {
  const allowed = baseline[f] ?? 0
  if (n > allowed) failures.push(`${f}: ${n} violations (baseline ${allowed}) ${JSON.stringify(detail[f])}`)
}
if (failures.length) {
  console.error('ui-lint: new design-system violations (see DESIGN-SYSTEM-V2.md section 11):\n  ' + failures.join('\n  '))
  process.exit(1)
}
console.log(`ui-lint ok: ${Object.keys(counts).length} files within baseline.`)
