// FrozenHub 1 printed invoice: Preview, Print and Download PDF from Billing History at every viewport.
// Synthetic local tenant only (frozenhub1-test on the isolated synthetic host). The tenant carries FrozenHub 1's
// production print settings with the approved locked bilingual header; the spec creates one discounted credit sale.
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apiLogin, signIn, feOrigin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'frozenhub1-test'
const preview = (page) => page.getByRole('dialog', { name: 'Invoice preview' })
let sale

async function call (urlPath, method = 'GET', body, key) {
  const { token } = await apiLogin(SLUG)
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE,
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${urlPath}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  return json.data
}

/** Text of a PDF via PyMuPDF (isolated interpreter); the repo's other spec uses pdftotext when installed. */
function pdfText (file) {
  // -I ignores PYTHON* env vars, so switch stdout to UTF-8 inside the script (Arabic text on Windows consoles).
  const script = 'import sys,pymupdf;sys.stdout.reconfigure(encoding="utf-8");d=pymupdf.open(sys.argv[1]);print("\\n".join(p.get_text() for p in d));print("PAGES",d.page_count)'
  return execFileSync('python', ['-I', '-c', script, file], { encoding: 'utf8' })
}

test.beforeAll(async () => {
  const stamp = `${Date.now()}`
  const customer = await call('/api/customers', 'POST', { name: `DILKUSH QA ${stamp}`, phone: `055${stamp.slice(-7)}`, creditLimit: 5000, customerType: 'Credit' })
  const products = []
  for (let i = 1; i <= 5; i++) {
    products.push(await call('/api/products', 'POST', {
      sku: `FHQA-${stamp}-${i}`, nameEn: `FROZEN QA ITEM ${i} 18KG`, unitType: 'CRTN', conversionToBase: 1, costPrice: 40, sellPrice: 50, stockQty: 0,
    }))
  }
  await call('/api/purchases', 'POST', {
    supplierName: `FH QA stock ${stamp}`, invoiceNo: `FHQA-S-${stamp}`, purchaseDate: new Date().toISOString().slice(0, 10),
    paymentType: 'Cash', items: products.map((p) => ({ productId: p.id, unitType: 'CRTN', qty: 20, unitCost: 40 })),
  }, `fhqa-stock-${stamp}`)
  sale = await call('/api/sales', 'POST', {
    customerId: customer.id, externalReference: `fhqa-${stamp}`, discount: 5,
    items: products.map((p, i) => ({ productId: p.id, unitType: 'CRTN', qty: i + 1, unitPrice: 50 })),
  })
  expect(sale.invoiceNo, 'sale created').toBeTruthy()
})

async function openPreview (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/billing-history`, { waitUntil: 'networkidle' })
  const wide = page.viewportSize().width >= 768
  if (wide) {
    const row = page.locator('tr', { hasText: sale.invoiceNo })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'View Invoice' }).click()
  } else {
    await page.getByRole('button', { name: `Open invoice ${sale.invoiceNo}` }).click()
  }
  await expect(preview(page).getByRole('heading', { name: /^Invoice Preview/ })).toBeVisible()
  await expect(preview(page).getByText('Grand Total:')).toBeVisible()
  await expect(preview(page)).toContainText(Number(sale.grandTotal).toFixed(2))
  // On-screen totals must reconcile like the printed ones: Subtotal - Discount + VAT = Grand Total.
  await expect(preview(page).getByText('Discount:')).toBeVisible()
  await expect(preview(page)).toContainText('-5.00')
}

test('preview, print and download the FrozenHub invoice', async ({ page }, testInfo) => {
  const vp = page.viewportSize()
  await openPreview(page)
  await page.screenshot({ path: testInfo.outputPath(`preview-${vp.width}.png`), fullPage: false })

  // Download PDF
  await preview(page).getByRole('button', { name: 'Share', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog', { name: 'Share invoice' }).getByRole('button', { name: /Download PDF/ }).click(),
  ])
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fh1-inv-')), 'invoice.pdf')
  await download.saveAs(file)
  try {
    expect(download.suggestedFilename()).toBe(`invoice_${sale.invoiceNo}.pdf`)
    const text = pdfText(file)
    expect(text).toContain(sale.invoiceNo)
    expect(text).toContain('Abu Dhabi, Musaffah 17')
    expect(text).not.toContain('971555298878')
    expect(text).not.toContain('frozenhubfoods@gmail.com')
    expect(text).toContain('Discount')
    expect(text).toContain('5.00')
    expect(text).toContain(Number(sale.grandTotal).toFixed(2))
    expect(text).toContain("Receiver's Name")
    expect(text).toContain("Receiver's Sign")
    fs.copyFileSync(file, testInfo.outputPath(`download-${vp.width}.pdf`))
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  }

  // Print: locked header policy forces the plain-paper (full) layout; the A4 PDF request must succeed.
  await preview(page).getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByRole('dialog', { name: 'Share invoice' }).getByRole('button', { name: /^Print/ }).click()
  await expect(page.getByRole('heading', { name: 'Print Options' })).toBeVisible()
  await expect(page.locator('input[name="invoice-paper-layout"]:checked')).toHaveCount(1)
  // The primary Print action must be on screen at every width (it used to fall below the fold on phones).
  const printButton = page.getByRole('button', { name: /^Print$|Print invoice/ }).last()
  const box = await printButton.boundingBox()
  expect(box, 'Print button rendered').toBeTruthy()
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.height).toBeGreaterThanOrEqual(44)
  const pdfResponse = page.waitForResponse((r) => r.url().includes(`/api/sales/${sale.id}/pdf`) && r.request().method() === 'GET')
  await printButton.click()
  const res = await pdfResponse
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type'] || '').toMatch(/pdf/)
  expect(res.url()).toMatch(/layout=full/)
  await page.screenshot({ path: testInfo.outputPath(`print-${vp.width}.png`), fullPage: false })
})
