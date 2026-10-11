// VAT exports (VR-02): the files the VAT page offers carry the same figures as the API for the same quarter.
// CSV: output rows add up to Box 1a / Box 1b, claimable input VAT adds up to Box 9b, and the management summary lines
// match. Excel: a real workbook (zip). PDF: a real PDF whose text has the company name and the period (needs pdftotext;
// that part skips if it is not installed). API only, read-only. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'
const FROM = '2026-08-01'
const TO = '2026-10-31'

async function get (url, token) {
  return fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE } })
}

// Minimal CSV reader for these files (quoted fields, a leading BOM).
const parseCsv = (text) => text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map((line) => {
  const cells = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { cells.push(cur); cur = '' } else cur += ch
  }
  cells.push(cur)
  return cells
})

const hasPdftotext = () => { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true } catch (e) { return e.code !== 'ENOENT' } }

test('VAT CSV files add up to the API boxes for the quarter', async () => {
  const { token } = await apiLogin(SLUG)
  const vat = (await (await get(`/api/reports/vat-return?from=${FROM}&to=${TO}`, token)).json()).data
  expect(vat.box1a, 'the quarter has output VAT').toBeGreaterThan(0)

  const rowsCsv = parseCsv(await (await get(`/api/reports/vat-return/export/csv?from=${FROM}&to=${TO}`, token)).text())
  const head = rowsCsv[0]
  const col = (name) => head.indexOf(name)
  const lines = rowsCsv.slice(1)
  const sum = (rows, c) => rows.reduce((t, r) => t + (Number(r[col(c)]) || 0), 0)
  const output = lines.filter((r) => r[col('Type')] === 'Output')
  expect(output.length, 'output rows in the CSV').toBeGreaterThan(0)
  expect(sum(output, 'NetAmount')).toBeCloseTo(vat.box1a, 2)
  expect(sum(output, 'VatAmount')).toBeCloseTo(vat.box1b, 2)
  expect(sum(lines.filter((r) => r[col('Type')] !== 'Output'), 'ClaimableVat'), 'claimable input VAT').toBeCloseTo(vat.box9b, 2)

  const mgmt = parseCsv(await (await get(`/api/reports/vat-management/export/csv?from=${FROM}&to=${TO}`, token)).text())
  const kv = Object.fromEntries(mgmt.filter((r) => r.length === 2).map((r) => [r[0], r[1]]))
  expect(Number(kv.StandardOutputVat)).toBeCloseTo(vat.standardOutputVat, 2)
  expect(Number(kv.RecoverableInputVat)).toBeCloseTo(vat.recoverableInputVat, 2)
  expect(Number(kv.NetVatPayable)).toBeCloseTo(vat.netVatPayable, 2)
  expect(kv.Period).toBe(`${FROM} to ${TO}`)
})

test('VAT Excel and PDF files are real files for the quarter', async () => {
  const { token } = await apiLogin(SLUG)
  const xlsx = await get(`/api/reports/vat-return/export/excel?from=${FROM}&to=${TO}`, token)
  expect(xlsx.status).toBe(200)
  const bytes = Buffer.from(await xlsx.arrayBuffer())
  expect(bytes.subarray(0, 2).toString('latin1'), 'an .xlsx workbook is a zip').toBe('PK')
  expect(bytes.length).toBeGreaterThan(1000)

  const pdf = await get(`/api/reports/vat-management/export/pdf?from=${FROM}&to=${TO}`, token)
  expect(pdf.status).toBe(200)
  const pdfBytes = Buffer.from(await pdf.arrayBuffer())
  expect(pdfBytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
  test.skip(!hasPdftotext(), 'pdftotext is not installed; the PDF text check is skipped')
  const settings = (await (await get('/api/settings', token)).json()).data || {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-vat-'))
  const file = path.join(dir, 'vat.pdf')
  fs.writeFileSync(file, pdfBytes)
  try {
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
    expect(text.toLowerCase()).toContain(String(settings.COMPANY_NAME_EN).toLowerCase())
    // The PDF prints dates as 01-Aug-2026.
    expect(text).toContain('Period: 01-Aug-2026 to 31-Oct-2026')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
