import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = 'gulfharvest-test'
test.use({ trace: 'off' })

async function openForm (page) {
  await signIn(page, SLUG)
  await page.goto(`${feOrigin(SLUG)}/suppliers`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add Supplier', exact: true }).filter({ visible: true }).click()
  return page.getByRole('dialog').filter({ has: page.getByPlaceholder('e.g. Gulf Frozen Foods') })
}

async function listSuppliers () {
  const session = await apiLogin(SLUG)
  const res = await fetch(`${API}/api/suppliers/summary?includeInactive=true`, {
    headers: { Authorization: `Bearer ${session.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE },
  })
  return (await res.json()).data
}

test('messy supplier values are fixed, explained and saved once', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-7)
  const form = await openForm(page)
  await form.getByPlaceholder('e.g. Gulf Frozen Foods').fill(`  QA   Supplier  ${stamp} `)
  await form.getByPlaceholder('e.g. +971 50 123 4567').fill('+971  50 123 4567 ext')
  await form.getByPlaceholder('e.g. sales@supplier.com').fill(' Sales@QA-Supplier.COM ')
  await form.getByPlaceholder('e.g. 5000 (empty = no limit)').fill('-20')
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/suppliers$/.test(r.url()))
  await form.getByRole('button', { name: 'Create Supplier', exact: true }).click()
  const response = await saved
  expect(response.status()).toBeLessThan(300)
  const sent = response.request().postDataJSON()
  expect(sent).toMatchObject({ name: `QA Supplier ${stamp}`, phone: '+971 50 123 4567', email: 'sales@qa-supplier.com', creditLimit: 0 })
  await expect(page.getByText(/We fixed:/).first()).toBeVisible()
  const rows = (await listSuppliers()).filter(s => s.supplierName === `QA Supplier ${stamp}`)
  expect(rows).toHaveLength(1)
})

test('a lost server answer after a supplier was saved is not shown as a failure', async ({ page }) => {
  const stamp = `${Date.now()}`.slice(-7)
  const name = `QA Lost Supplier ${stamp}`
  const form = await openForm(page)
  let posts = 0
  await page.route(/\/api\/suppliers$/, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    await route.fetch({
      url: `${API}/api/suppliers`,
      headers: { ...route.request().headers(), 'x-hexabill-original-host': `${SLUG}.localhost`, 'x-hexabill-edge-secret': EDGE },
    })
    return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
  })
  await form.getByPlaceholder('e.g. Gulf Frozen Foods').fill(name)
  await form.getByRole('button', { name: 'Create Supplier', exact: true }).click()
  await expect(page.getByText('Supplier created successfully').first()).toBeVisible()
  await expect(form).toBeHidden()
  expect(posts).toBe(1)
  expect((await listSuppliers()).filter(s => s.supplierName === name)).toHaveLength(1)
})
