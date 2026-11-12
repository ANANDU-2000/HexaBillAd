/**
 * Turn ui-inventory JSON into a markdown table + top-offender list.
 * Usage: node scripts/ui-inventory-report.mjs <dir> [viewport...]
 * Reads <dir>/<viewport>.json written by e2e/ui-inventory.spec.js.
 */
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/ui-inventory-report.mjs <inventory dir> [m390 t768 d1440]')
  process.exit(1)
}
const viewports = process.argv.slice(3).length ? process.argv.slice(3) : ['m390', 't768', 'd1440']
const lines = []
const offenders = { overflow: [], small: [], tiny: [], bars: [], loader: [], error: [], failed: [] }

for (const vp of viewports) {
  const file = path.join(dir, `${vp}.json`)
  if (!fs.existsSync(file)) continue
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  lines.push(`\n### ${vp} (${rows.length} routes)\n`)
  lines.push('| page | h | overflow | small | tiny | bars | loader | error | failed |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    lines.push(`| ${r.route} | ${r.height} | ${r.overflow ? 'YES' : ''} | ${r.smallCount} | ${r.tinyCount} | ${r.bars.length} | ${r.loader ? 'YES' : ''} | ${r.errorCard ? 'YES' : ''} | ${r.failed.length} |`)
    if (r.overflow) offenders.overflow.push(`${vp} ${r.route}`)
    if (r.smallCount > 0) offenders.small.push(`${vp} ${r.route} (${r.smallCount})`)
    if (r.tinyCount > 0) offenders.tiny.push(`${vp} ${r.route} (${r.tinyCount})`)
    if (r.bars.length) offenders.bars.push(`${vp} ${r.route} (${r.bars.length})`)
    if (r.loader) offenders.loader.push(`${vp} ${r.route}`)
    if (r.errorCard) offenders.error.push(`${vp} ${r.route}`)
    if (r.failed.length) offenders.failed.push(`${vp} ${r.route}: ${r.failed.join(' ')}`)
  }
}

lines.push('\n## Top offenders\n')
for (const [key, list] of Object.entries(offenders)) {
  lines.push(`- **${key}** (${list.length}): ${list.slice(0, 12).join(', ') || 'none'}`)
}
console.log(lines.join('\n'))
