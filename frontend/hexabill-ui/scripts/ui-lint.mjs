// UI slop ratchet: counts design-system violations per file and fails if any count goes UP.
// Usage: node scripts/ui-lint.mjs            (check)
//        node scripts/ui-lint.mjs --update-baseline   (after fixing violations, lock in the lower numbers)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(root, 'scripts', 'ui-lint-baseline.json')
const SCAN_DIRS = ['src/features', 'src/pages', 'src/components']

export const RULES = {
  offPalette: /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:violet|purple|indigo|teal|orange)-\d{2,3}\b/g,
  nativeDialog: /\b(?:window\.)?(?:confirm|alert)\(/g,
  borderL4: /\bborder-l-4\b/g,
  emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
}

// border-l-4 is allowed only inside the Alert primitive.
const ALLOWED = { borderL4: /components[\/]ui[\/]Alert\.jsx$/ }

export function scanSource(text, relPath = '') {
  const out = {}
  for (const [rule, re] of Object.entries(RULES)) {
    if (ALLOWED[rule]?.test(relPath)) continue
    const n = (text.match(re) || []).length
    if (n) out[rule] = n
  }
  return out
}

export function compare(current, baseline) {
  const failures = []
  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, n] of Object.entries(rules)) {
      const allowed = baseline[file]?.[rule] ?? 0
      if (n > allowed) failures.push(`${file}: ${rule} ${allowed} -> ${n}`)
    }
  }
  return failures
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(jsx?|tsx?)$/.test(e.name)) acc.push(p)
  }
  return acc
}

export function scanAll() {
  const res = {}
  for (const d of SCAN_DIRS) {
    for (const f of walk(path.join(root, d))) {
      const rel = path.relative(root, f).split(path.sep).join('/')
      const r = scanSource(fs.readFileSync(f, 'utf8'), rel)
      if (Object.keys(r).length) res[rel] = r
    }
  }
  return res
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const current = scanAll()
  if (process.argv.includes('--update-baseline')) {
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 1) + '\n')
    console.log(`ui-lint: baseline written (${Object.keys(current).length} files)`)
  } else {
    const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {}
    const failures = compare(current, baseline)
    if (failures.length) {
      console.error('ui-lint: new design-system violations:\n  ' + failures.join('\n  '))
      process.exit(1)
    }
    console.log('ui-lint: ok (no new violations)')
  }
}
