import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

// UTF-8 text that was once decoded as Windows-1252 shows up as "â€“", "Ã—", "Â·" on screen.
// UI-015/UI-016 came from such sequences committed into the source itself.
const src = join(dirname(fileURLToPath(import.meta.url)), '../src')
const MOJIBAKE = /[Â-Ãâ][\u0080-¿€‚-›™]/

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : ['.js', '.jsx', '.css'].includes(extname(p)) ? [p] : []
  })

test('frontend source has no double-encoded UTF-8 (mojibake)', () => {
  const hits = []
  for (const file of walk(src)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (MOJIBAKE.test(line)) hits.push(`${file.slice(src.length + 1)}:${i + 1}`)
    })
  }
  assert.deepEqual(hits, [])
})
