// Supplier edit and statement: edit the contact details from the Suppliers list, confirm the change through
// the API, and restore the original details. Download the supplier statement PDF from the ledger.
// Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const SEEDED = 'UX Audit Supplier Gulf Produce LLC'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.token}`,
      'X-HexaBill-Original-Host': `${SLUG}.localhost`,
      'X-HexaBill-Edge-Secret': EDGE,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const supplierByName = async (name) => (await api(`/api/suppliers/by-name/${encodeURIComponent(name)}`)).json.data

test('edit a supplier from the list: the change is saved and read back through the API', async ({ page }) => {
  const original = await supplierByName(SEEDED)
  const phone = '+971500000777'
  const address = `UX edit ${Date.now()}, Dubai`
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers`, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: `More actions for ${SEEDED}` }).filter({ visible: true }).first().click()
  await page.getByRole('menuitem', { name: 'Edit supplier' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Supplier' }).first()
  await expect(dialog).toBeVisible()
  // The fields are disabled until the saved details load; typing before that would be overwritten.
  await expect(dialog.getByText('Loading supplier details')).toBeHidden()
  await dialog.locator('#edit-phone').fill(phone)
  await dialog.locator('#edit-address').fill(address)

  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/suppliers\//.test(r.url()))
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  const savedRes = await saved
  if (savedRes.status() >= 300) throw new Error(`PUT /api/suppliers ${savedRes.status()}: ${await savedRes.text()}`)
  await expect(dialog).toBeHidden()

  try {
    await expect.poll(async () => {
      const d = await supplierByName(SEEDED)
      return [d.phone, d.address]
    }).toEqual([phone, address])
    // Read back after a refresh: the ledger header shows the same supplier with the new details.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: `More actions for ${SEEDED}` }).filter({ visible: true }).first()).toBeVisible()
  } finally {
    // Restore the original contact details.
    await api(`/api/suppliers/${encodeURIComponent(SEEDED)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: SEEDED,
        phone: original.phone ?? undefined,
        address: original.address ?? undefined,
        creditLimit: original.creditLimit ?? 0,
        paymentTerms: original.paymentTerms ?? undefined,
      }),
    })
  }
})

test('supplier ledger: the statement PDF is produced by the server', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers/${encodeURIComponent(SEEDED)}`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Ledger' }).click()
  const statement = page.waitForResponse((r) => r.request().method() === 'GET' && /\/statement/.test(r.url()))
  await page.getByRole('button', { name: 'Statement PDF' }).filter({ visible: true }).first().click()
  const res = await statement
  expect(res.status()).toBe(200)
  expect(String(res.headers()['content-type'] || '')).toContain('application/pdf')
  const body = await res.body()
  expect(body.length, 'statement PDF must not be empty').toBeGreaterThan(1000)
  expect(body.subarray(0, 4).toString()).toBe('%PDF')
})

// Regression: the edit form used to overwrite what the user typed when the saved details arrived late.
// While the details load the fields and Save are disabled; once loaded, the saved values are shown.
test('supplier edit: fields are disabled while the saved details load, then show them', async ({ page }) => {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers`, { waitUntil: 'networkidle' })
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route((url) => /\/api\/suppliers\/by-name\//.test(url.pathname), async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await gate
    return route.continue()
  })
  await page.getByRole('button', { name: `More actions for ${SEEDED}` }).filter({ visible: true }).first().click()
  await page.getByRole('menuitem', { name: 'Edit supplier' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Supplier' }).first()
  await expect(dialog.getByText('Loading supplier details')).toBeVisible()
  await expect(dialog.locator('#edit-phone')).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  release()
  await page.unroute((url) => /\/api\/suppliers\/by-name\//.test(url.pathname))
  await expect(dialog.getByText('Loading supplier details')).toBeHidden()
  await expect(dialog.locator('#edit-phone')).toBeEnabled()
  await expect(dialog.locator('#edit-phone')).not.toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})
