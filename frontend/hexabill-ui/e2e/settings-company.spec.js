// Settings > Company: save the company name and read it back through the API and after a reload; an invalid
// VAT TRN is refused next to its field with no request sent. The original name is restored through the
// single-key endpoint. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest'

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

const settingValue = async (key) => (await api('/api/settings')).json.data?.[key]

test('company name: saved, read back through the API and after a reload, then restored', async ({ page }) => {
  const original = await settingValue('COMPANY_NAME_EN')
  expect(original, 'the company name must be set on the local tenant').toBeTruthy()
  const changed = `UX Co ${Date.now() % 100000}`
  try {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/settings`, { waitUntil: 'networkidle' })
    const field = page.getByLabel('Company Name (English)').filter({ visible: true }).first()
    await expect(field).toHaveValue(original)
    await field.fill(changed)
    const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/settings$/.test(r.url()))
    // The header "Save Changes" button (it appears once something changed) must save as well as the bottom button.
    await page.getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).first().click()
    const res = await saved
    if (res.status() >= 300) throw new Error(`PUT /api/settings ${res.status()}: ${await res.text()}`)

    await expect.poll(() => settingValue('COMPANY_NAME_EN')).toBe(changed)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('Company Name (English)').filter({ visible: true }).first()).toHaveValue(changed)
  } finally {
    await api('/api/settings/COMPANY_NAME_EN', { method: 'PUT', body: JSON.stringify(original) })
  }
  await expect.poll(() => settingValue('COMPANY_NAME_EN')).toBe(original)
})

test('VAT TRN: a value that is not 15 digits is refused next to the field and nothing is saved', async ({ page }) => {
  const originalTrn = await settingValue('vat_trn')
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/settings`, { waitUntil: 'networkidle' })
  const trn = page.getByLabel('VAT TRN').filter({ visible: true }).first()
  await trn.fill('12345')
  let puts = 0
  page.on('request', (r) => { if (r.method() === 'PUT' && /\/api\/settings/.test(r.url())) puts += 1 })
  await page.getByRole('button', { name: 'Save Settings', exact: true }).filter({ visible: true }).first().click()
  await expect(page.getByText('VAT TRN must contain exactly 15 digits').filter({ visible: true }).first()).toBeVisible()
  expect(puts).toBe(0)
  expect(await settingValue('vat_trn')).toBe(originalTrn)
})
