// E2E-G1 / H03: runs scripts/money-snapshot.mjs inside the wrapper (the API is up). H03_LABEL / H03_COMPARE pick the mode.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/money-snapshot.mjs')

test('H03 money snapshot: label written, compare (if requested) identical', async () => {
  const label = process.env.H03_LABEL || 'after'
  const compare = process.env.H03_COMPARE || ''
  const argv = [script, '--label', label, ...(compare ? ['--compare', compare] : [])]
  const out = execFileSync(process.execPath, argv, { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
  console.log(out)
  expect(out).toMatch(/money snapshot/)
})
