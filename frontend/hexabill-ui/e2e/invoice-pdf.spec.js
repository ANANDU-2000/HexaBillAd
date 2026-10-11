// Printed invoice (SE-03): the invoice PDF carries the saved company name and VAT TRN from Settings, and the invoice
// number. API only and read-only. The text is read with `pdftotext` (poppler); the test skips if it is not installed.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

async function get (url, token) {
  return fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE } })
}

const hasPdftotext = () => { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true } catch (e) { return e.status !== undefined && e.code !== 'ENOENT' } }

test('invoice PDF shows the saved company name, VAT TRN and invoice number', async () => {
  test.skip(!hasPdftotext(), 'pdftotext is not installed')
  const { token } = await apiLogin(SLUG)
  const settings = (await (await get('/api/settings', token)).json()).data || {}
  const name = settings.COMPANY_NAME_EN
  const trn = String(settings.vat_trn || '').replace(/\s/g, '')
  expect(name, 'company name is saved').toBeTruthy()
  expect(trn, 'VAT TRN is saved').toMatch(/^\d{15}$/)

  const sales = (await (await get('/api/sales?page=1&pageSize=1', token)).json()).data
  const sale = (sales.items || sales)[0]
  expect(sale, 'a sale exists').toBeTruthy()
  const res = await get(`/api/sales/${sale.id}/pdf`, token)
  expect(res.status, 'invoice PDF is returned').toBe(200)
  expect(res.headers.get('content-type') || '').toMatch(/pdf/)
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-inv-')), 'invoice.pdf')
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  try {
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
    expect(text.toLowerCase(), 'company name on the invoice').toContain(String(name).toLowerCase())
    expect(text.replace(/\s/g, ''), 'VAT TRN on the invoice').toContain(trn)
    expect(text, 'invoice number on the invoice').toContain(sale.invoiceNo)
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  }
})
