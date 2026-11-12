// Renders docs/uiux/evidence/concurrency/2026-11-08.md tables from raw-*.json (numbers only; bugs/notes are hand-written below the tables).
import fs from 'node:fs'
import path from 'node:path'
const dir = path.resolve('docs/uiux/evidence/concurrency')
const rows = []; const detail = []
for (const f of fs.readdirSync(dir).filter((x) => /^raw-.*\.json$/.test(x))) {
  for (const sc of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).results) {
    const runs = sc.runs
    const ok = (r) => r.checks.filter((c) => c.pass).length
    const fail = runs.flatMap((r) => r.checks.filter((c) => !c.pass).map((c) => `run${r.run}: ${c.name}`))
    const dl = runs.flatMap((r) => r.checks.filter((c) => /deadlock/.test(c.name))).map((c) => c.detail.match(/deadlock=(\d+)/)?.[1] || 0).reduce((a, b) => a + Number(b), 0)
    rows.push(`| ${sc.name} | ${runs.length} | ${runs.map((r) => r.n).join('/')} | ${runs.map((r) => r.p50).join('/')} | ${runs.map((r) => r.p95).join('/')} | ${runs.map((r) => `${r.serverErrors} (${r.errorRate}%)`).join('/')} | ${dl} | ${runs.map((r) => `${ok(r)}/${r.checks.length}`).join(' ')} | ${fail.length ? 'FAIL' : 'PASS'} |`)
    if (fail.length) detail.push(`- ${sc.id.toUpperCase()} failed checks: ${[...new Set(fail.map((x) => x.replace(/^run\d+: /, '')))].join('; ')} (runs: ${[...new Set(fail.map((x) => x.match(/^run(\d)/)[1]))].join(',')})`)
    for (const r of runs) if (r.perEndpoint) detail.push(`- ${sc.id.toUpperCase()} run ${r.run} per endpoint (ms): ${Object.entries(r.perEndpoint).filter(([k]) => k !== 'solo' && k !== 'stress').map(([k, v]) => `${k} p50=${v.p50} p95=${v.p95} (solo p50 ${r.perEndpoint.solo[k].p50})`).join('; ')}; stress(75 in flight) p50=${r.perEndpoint.stress.p50} p95=${r.perEndpoint.stress.p95} max=${r.perEndpoint.stress.max}`)
  }
}
rows.sort()
console.log('| Scenario | Runs | Requests per run | p50 ms per run | p95 ms per run | 5xx/network errors per run | Deadlocks (pg_stat_database) | Checks passed per run | Result |\n|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n\n' + detail.join('\n'))
