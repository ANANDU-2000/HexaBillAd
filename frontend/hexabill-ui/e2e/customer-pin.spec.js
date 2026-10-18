// Customer shop location without coordinates: "I'm at this shop", "Choose on map", "Set later", replace and remove with
// confirmation, GPS denied fallback. The API read-back proves what was stored. Synthetic local tenant only; needs the
// stop-location feature flag ON in the API (FeatureFlags__CustomerStopLocation=true). Removes what it adds.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []
const findByName = async (name) => items((await api(`/api/customers?page=1&pageSize=100&search=${encodeURIComponent(name)}`)).json).find((c) => c.name === name) || null

async function removeLeftovers () {
  for (const c of items((await api('/api/customers?page=1&pageSize=100&search=UX%20Pin')).json)) {
    if (/^UX Pin /.test(c.name || '') && !Number(c.balance)) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
  }
}

async function openAdd (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/customers`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add customer' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  return dialog
}

async function fillBasics (dialog, name) {
  await dialog.getByLabel(/Customer Name/).fill(name)
  await dialog.getByLabel(/Phone/).first().fill(`0502${String(Date.now()).slice(-6)}`)
  await dialog.locator('select[name="branchId"]').selectOption({ index: 1 })
  await expect(dialog.locator('select[name="routeId"] option')).not.toHaveCount(1)
  await dialog.locator('select[name="routeId"]').selectOption({ index: 1 })
}

async function saveAdd (page, dialog) {
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/customers$/.test(r.url()))
  await dialog.getByRole('button', { name: 'Add Customer', exact: true }).click()
  const res = await created
  if (res.status() >= 300) throw new Error(`POST /api/customers ${res.status()}: ${await res.text()}`)
  await expect(dialog).toBeHidden()
}

async function pickOnMap (page, position) {
  await page.getByRole('button', { name: 'Choose on map' }).click()
  const mapDialog = page.getByRole('dialog').filter({ hasText: 'Choose the shop on the map' }).last()
  await expect(mapDialog).toBeVisible()
  await mapDialog.locator('.leaflet-container').click({ position })
  return mapDialog
}

test.describe('location allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 25.2048, longitude: 55.2708, accuracy: 20 } })

  test('add: no coordinate fields; "I\'m at this shop" saves the pin; stored with who and when', async ({ page }) => {
    await removeLeftovers()
    const name = `UX Pin ${Date.now()}`
    try {
      const dialog = await openAdd(page)
      await expect(dialog.getByLabel('Latitude')).toHaveCount(0)
      await expect(dialog.getByLabel('Longitude')).toHaveCount(0)
      await expect(dialog.getByTestId('pin-status')).toContainText('No shop location yet')
      await expect(dialog.getByRole('button', { name: /I'm at this shop/ })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Choose on map' })).toBeVisible()

      await fillBasics(dialog, name)
      await dialog.getByRole('button', { name: /I'm at this shop/ }).click()
      await expect(dialog.getByTestId('pin-preview')).toBeVisible()
      await expect(dialog.getByTestId('pin-status')).toContainText('Location chosen')
      // The pair is never shown as numbers.
      await expect(dialog.getByTestId('customer-pin-field')).not.toContainText(/25\.20/)
      await saveAdd(page, dialog)

      const saved = await findByName(name)
      expect(Number(saved.mainLatitude)).toBeCloseTo(25.2048, 3)
      expect(Number(saved.mainLongitude)).toBeCloseTo(55.2708, 3)
      expect(saved.locationUpdatedAt).toBeTruthy()
    } finally {
      const c = await findByName(name)
      if (c) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
    }
  })

  test('add: "Set later" drops the choice and saves a customer without a pin', async ({ page }) => {
    await removeLeftovers()
    const name = `UX Pin ${Date.now()}`
    try {
      const dialog = await openAdd(page)
      await fillBasics(dialog, name)
      await dialog.getByRole('button', { name: /I'm at this shop/ }).click()
      await expect(dialog.getByTestId('pin-preview')).toBeVisible()
      await dialog.getByRole('button', { name: 'Set later' }).click()
      await expect(dialog.getByTestId('pin-preview')).toHaveCount(0)
      await expect(dialog.getByTestId('pin-status')).toContainText('No shop location yet')
      await saveAdd(page, dialog)
      const saved = await findByName(name)
      expect(saved.mainLatitude ?? null).toBeNull()
    } finally {
      const c = await findByName(name)
      if (c) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
    }
  })

  test('edit: choose on map asks to replace; saved; then remove needs a confirmation', async ({ page }) => {
    await removeLeftovers()
    const name = `UX Pin ${Date.now()}`
    try {
      const dialog = await openAdd(page)
      await fillBasics(dialog, name)
      await dialog.getByRole('button', { name: /I'm at this shop/ }).click()
      await saveAdd(page, dialog)
      const first = await findByName(name)

      // Open the edit form from the row menu.
      await page.getByRole('searchbox', { name: 'Search customers' }).or(page.getByLabel('Search customers')).first().fill(name)
      await expect(page.getByRole('button', { name: /^More actions for / }).filter({ visible: true })).toHaveCount(1)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: `More actions for ${name}` }).filter({ visible: true }).first().click()
      await page.getByRole('menuitem', { name: 'Edit customer' }).click()
      const edit = page.getByRole('dialog').first()
      await expect(edit.getByTestId('pin-status')).toContainText('Shop location saved')
      await expect(edit.getByRole('link', { name: /Open in maps/ })).toBeVisible()

      // Replace: the confirm button says so, and nothing changes until the form is saved.
      const mapDialog = await pickOnMap(page, { x: 150, y: 200 })
      await expect(mapDialog.getByRole('button', { name: 'Replace saved location' })).toBeEnabled()
      await mapDialog.getByRole('button', { name: 'Replace saved location' }).click()
      await expect(edit.getByTestId('pin-status')).toContainText('replaces the saved one')
      expect(Number((await findByName(name)).mainLatitude)).toBeCloseTo(Number(first.mainLatitude), 6)
      let put = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/customers\/\d+$/.test(r.url()))
      await edit.getByRole('button', { name: /Update|Save/ }).click()
      expect((await put).status()).toBeLessThan(300)
      await expect.poll(async () => Number((await findByName(name)).mainLatitude)).not.toBeCloseTo(Number(first.mainLatitude), 3)

      // Remove: asks first; "Keep it" changes nothing.
      await page.getByRole('button', { name: `More actions for ${name}` }).filter({ visible: true }).first().click()
      await page.getByRole('menuitem', { name: 'Edit customer' }).click()
      const edit2 = page.getByRole('dialog').first()
      await edit2.getByRole('button', { name: 'Remove saved location' }).click()
      await expect(edit2.getByTestId('pin-remove-confirm')).toBeVisible()
      await edit2.getByRole('button', { name: 'Keep it' }).click()
      await expect(edit2.getByTestId('pin-remove-confirm')).toHaveCount(0)
      await edit2.getByRole('button', { name: 'Remove saved location' }).click()
      await edit2.getByRole('button', { name: 'Yes, remove it' }).click()
      await expect(edit2.getByTestId('pin-status')).toContainText('will be removed')
      put = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/customers\/\d+$/.test(r.url()))
      await edit2.getByRole('button', { name: /Update|Save/ }).click()
      expect((await put).status()).toBeLessThan(300)
      await expect.poll(async () => (await findByName(name)).mainLatitude ?? null).toBeNull()
    } finally {
      const c = await findByName(name)
      if (c) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
    }
  })

  test('add: choose on map, then save', async ({ page }) => {
    await removeLeftovers()
    const name = `UX Pin ${Date.now()}`
    try {
      const dialog = await openAdd(page)
      await fillBasics(dialog, name)
      const mapDialog = await pickOnMap(page, { x: 200, y: 120 })
      await mapDialog.getByRole('button', { name: 'Use this location' }).click()
      await expect(dialog.getByTestId('pin-preview')).toBeVisible()
      await saveAdd(page, dialog)
      expect((await findByName(name)).mainLatitude).not.toBeNull()
    } finally {
      const c = await findByName(name)
      if (c) await api(`/api/customers/${c.id}`, { method: 'DELETE' })
    }
  })
})

test.describe('location denied', () => {
  test.use({ permissions: [] })

  test('denied permission explains itself and the map still works', async ({ page }) => {
    await removeLeftovers()
    const dialog = await openAdd(page)
    await dialog.getByRole('button', { name: /I'm at this shop/ }).click()
    await expect(dialog.getByTestId('pin-problem')).toContainText(/permission|could not|cannot/i)
    await expect(dialog.getByTestId('pin-preview')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Choose on map' })).toBeEnabled()
  })
})
