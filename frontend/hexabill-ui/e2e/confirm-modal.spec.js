// UX-A03: destructive actions use the in-app confirm modal, never the browser's native confirm().
// Quotations stands in for the shared useConfirmDialog hook used by Agreements, Salary certificates,
// Recurring invoices, VAT return and the POS draft prompt. Only /api/quotations is intercepted.
// Local/dev only. Run: npx playwright test e2e/confirm-modal.spec.js --project=d1440 --project=m360
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const ROWS = [
  { id: 9101, quoteNo: 'QT-9101', quoteDate: '2026-11-03' /* newest first: its Delete button is the first one */, customerName: 'Confirm Test Trading', grandTotal: 105, status: 'Draft', subject: 'A03 check' },
  { id: 9102, quoteNo: 'QT-9102', quoteDate: '2026-11-02', customerName: 'Confirm Test Two', grandTotal: 210, status: 'Draft', subject: 'A03 check' },
]

test('delete asks in an in-app modal, Cancel keeps the row, Confirm deletes it', async ({ page }, info) => {
  await signIn(page, SLUG)

  const nativeDialogs = []
  page.on('dialog', (d) => { nativeDialogs.push(d.message()); d.dismiss().catch(() => {}) })

  const deletes = []
  let rows = [...ROWS]
  await page.route((url) => /\/api\/quotations(\/\d+)?$/.test(url.pathname), (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET' && url.pathname.endsWith('/quotations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: rows }) })
    }
    if (req.method() === 'DELETE') {
      const id = Number(url.pathname.split('/').pop())
      deletes.push(id)
      rows = rows.filter((r) => r.id !== id)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
    }
    return route.continue()
  })

  await page.goto(`${feOrigin(SLUG)}/quotations`, { waitUntil: 'networkidle' })
  const deleteButton = page.getByRole('button', { name: /^(Delete\b|.*Delete QT-9101)/ }).filter({ visible: true }).first()
  await expect(deleteButton).toBeVisible()

  // 1. Open: an in-app dialog appears, nothing is deleted yet, no native dialog.
  await deleteButton.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Delete QT-9101?' })).toBeVisible()
  await expect(dialog).toContainText('This cannot be undone')
  expect(deletes, 'no DELETE before confirming').toEqual([])
  await page.screenshot({ path: info.outputPath(`confirm-open-${info.project.name}.png`) })

  // 2. Cancel: dialog closes, still no DELETE, both rows remain.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  expect(deletes).toEqual([])
  await expect(page.getByText('QT-9101').filter({ visible: true }).first()).toBeVisible()

  // 3. Confirm: exactly one DELETE for that row, then it disappears.
  await deleteButton.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete quotation' }).click()
  await expect.poll(() => deletes).toEqual([9101])
  await expect(page.getByText('QT-9101').filter({ visible: true })).toHaveCount(0)
  await expect(page.getByText('QT-9102').filter({ visible: true }).first()).toBeVisible()

  expect(nativeDialogs, 'native confirm()/alert() must never appear').toEqual([])
})
