// UX-008: "Change invoice number" (Owner/Admin). Fully mocked API with invented rows; no backend is contacted.
// Run: PW_CHANNEL=chromium npx playwright test e2e/invoice-number-change.spec.js --config e2e/ux008.config.js
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { feOrigin } from './session.js'

const SLUG = 'demo-shop'
const SHOTS = process.env.UX008_SHOTS || '/workspace/ux-audit/ux008'
fs.mkdirSync(SHOTS, { recursive: true })

function makeRows () {
  return [
    { id: 501, invoiceNo: '1791254852', customerName: 'Palm Grocers', customerId: 11, grandTotal: 420, paidAmount: 0, paymentStatus: 'Pending', invoiceDate: '2026-10-25T08:00:00Z', externalReference: 'pos-a1' },
    { id: 502, invoiceNo: '4120', customerName: 'Old Ledger Co', customerId: 12, grandTotal: 90, paidAmount: 90, paymentStatus: 'Paid', invoiceDate: '2026-03-02T08:00:00Z', externalReference: 'starplus:4120' },
  ]
}

async function setup (page, { role = 'Owner', putHandler } = {}) {
  const rows = makeRows()
  const puts = []
  await page.addInitScript((r) => {
    localStorage.setItem('token', 'synthetic-browser-fixture')
    localStorage.setItem('user', JSON.stringify({ id: 1, tenantId: 999, role: r, name: `Demo ${r}`, companyName: 'Demo Shop', mustChangePassword: false }))
  }, role)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const m = url.pathname.match(/^\/api\/sales\/(\d+)\/invoice-number$/)
    if (m && req.method() === 'PUT') {
      const body = JSON.parse(req.postData() || '{}')
      const dryRun = url.searchParams.get('dryRun') === 'true'
      puts.push({ id: Number(m[1]), dryRun, body })
      const out = putHandler({ id: Number(m[1]), dryRun, body, rows })
      return route.fulfill({ status: out.status, json: out.json })
    }
    let data = []
    if (url.pathname === '/api/auth/validate') data = { userId: 1, tenantId: 999, role, name: `Demo ${role}` }
    else if (url.pathname === '/api/sales') data = { items: rows, totalPages: 1, totalCount: rows.length, page: 1, pageSize: 20 }
    else if (/^\/api\/sales\/\d+$/.test(url.pathname)) data = { ...rows.find((r) => String(r.id) === url.pathname.split('/').pop()), items: [] }
    return route.fulfill({ json: { success: true, data, maintenanceMode: false } })
  })
  await page.goto(`${feOrigin(SLUG)}/billing-history`)
  await expect(page.getByText('Palm Grocers').filter({ visible: true }).first()).toBeVisible()
  return { rows, puts }
}

const vw = (page) => page.viewportSize().width
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}-${vw(page)}.png`, fullPage: false })

async function openAction (page, invoiceNo) {
  const direct = page.getByRole('button', { name: `Change invoice number ${invoiceNo}` }).filter({ visible: true })
  if (await direct.count()) { await direct.first().click(); return }
  await page.getByRole('button', { name: `More actions for ${invoiceNo}` }).filter({ visible: true }).first().click()
  await page.getByRole('menuitem', { name: 'Change invoice number' }).or(page.getByRole('button', { name: 'Change invoice number' })).filter({ visible: true }).first().click()
}

async function actionVisible (page, invoiceNo) {
  const direct = page.getByRole('button', { name: `Change invoice number ${invoiceNo}` }).filter({ visible: true })
  if (await direct.count()) return true
  const more = page.getByRole('button', { name: `More actions for ${invoiceNo}` }).filter({ visible: true })
  if (!(await more.count())) return false
  await more.first().click()
  const n = await page.getByText('Change invoice number', { exact: true }).filter({ visible: true }).count()
  await page.keyboard.press('Escape')
  return n > 0
}

async function assertModalFits (page) {
  const dialog = page.getByRole('dialog', { name: 'Change invoice number' })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vw(page) + 1)
  const input = dialog.getByLabel('New invoice number')
  // App policy (index.css): 16px form text and a 16px rem root at <=768 / touch; mouse desktops use the compact 14px root.
  const compact = vw(page) > 768
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe(compact ? '14px' : '16px')
  await expect(input).toHaveAttribute('inputmode', 'numeric')
  for (const b of await dialog.getByRole('button').filter({ visible: true }).all()) {
    const bb = await b.boundingBox()
    expect(bb.height, await b.innerText()).toBeGreaterThanOrEqual(compact ? 38 : 44)
  }
  return dialog
}

test('dry-run error is shown inline with one message, nothing written', async ({ page }) => {
  const { puts } = await setup(page, {
    putHandler: () => ({ status: 400, json: { success: false, message: 'Invoice number 7000 was already issued (including deleted or voided invoices) and cannot be used again.' } }),
  })
  expect(await actionVisible(page, '4120')).toBe(false) // imported row: no action
  await openAction(page, '1791254852')
  const dialog = await assertModalFits(page)
  await expect(dialog.getByTestId('current-invoice-number')).toHaveText('1791254852')
  await dialog.getByLabel('New invoice number').fill('70a')
  await expect(dialog.getByLabel('New invoice number')).toHaveValue('70')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Use at least 4 digits.')
  expect(puts).toHaveLength(0)
  await dialog.getByLabel('New invoice number').fill('7000')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Enter a reason for the change.')
  await dialog.getByLabel(/Reason/).fill('Series moved to 7000')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already been used')
  expect(puts).toEqual([{ id: 501, dryRun: true, body: { newInvoiceNumber: '7000', reason: 'Series moved to 7000' } }])
  await expect(page.locator('[role="status"]')).toHaveCount(0) // no toast on error
  await shot(page, 'dryrun-error')
})

test('success: dry run, confirm, real change, one toast, list refreshed', async ({ page }) => {
  const { puts } = await setup(page, {
    putHandler: ({ id, dryRun, body, rows }) => {
      const row = rows.find((r) => r.id === id)
      const old = row.invoiceNo
      if (!dryRun) row.invoiceNo = body.newInvoiceNumber
      return { status: 200, json: { success: true, data: { saleId: id, oldInvoiceNo: old, newInvoiceNo: body.newInvoiceNumber, dryRun, changed: true, inventoryTransactionsUpdated: 1 } } }
    },
  })
  await openAction(page, '1791254852')
  const dialog = await assertModalFits(page)
  await dialog.getByLabel('New invoice number').fill('07000')
  await expect(dialog.getByLabel('New invoice number')).toHaveValue('07000')
  await dialog.getByLabel('New invoice number').fill('7000')
  await dialog.getByLabel(/Reason/).fill('Series moved to 7000')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(dialog.getByText('Change 1791254852 to 7000?')).toBeVisible()
  await expect(dialog.getByText(/old number. Reprint/)).toBeVisible()
  await shot(page, 'confirm')
  await dialog.getByRole('button', { name: 'Change number' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('[role="status"]').filter({ hasText: 'Invoice 1791254852 is now 7000.' })).toHaveCount(1)
  await expect(page.locator('[role="status"]')).toHaveCount(1)
  await expect(page.getByText('7000', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  expect(puts.map((p) => p.dryRun)).toEqual([true, false])
  await shot(page, 'success')
})

test('409 on the real change asks to reload, no toast', async ({ page }) => {
  await setup(page, {
    putHandler: ({ dryRun, body }) => dryRun
      ? { status: 200, json: { success: true, data: { saleId: 501, oldInvoiceNo: '1791254852', newInvoiceNo: body.newInvoiceNumber, dryRun: true, changed: true, inventoryTransactionsUpdated: 0 } } }
      : { status: 409, json: { success: false, message: 'That invoice number was just taken or the invoice changed. Refresh and try again.' } },
  })
  await openAction(page, '1791254852')
  const dialog = await assertModalFits(page)
  await dialog.getByLabel('New invoice number').fill('7001')
  await dialog.getByLabel(/Reason/).fill('Fix')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Change number' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('This invoice was changed by someone else. Reload and try again.')
  await expect(page.locator('[role="status"]')).toHaveCount(0)
  await shot(page, 'conflict-409')
})

test('staff never sees the action', async ({ page }) => {
  await setup(page, { role: 'Staff', putHandler: () => ({ status: 403, json: {} }) })
  expect(await actionVisible(page, '1791254852')).toBe(false)
  await shot(page, 'staff-hidden')
})
