// Assistant "Ask" tab. Runs against an API started with the built-in MOCK provider (Ai__Enabled=true, Ai__Provider=mock,
// Ai__AllowCustomerData=true, HEXABILL_E2E_AI_MOCK=1), whose synthetic-only host echoes the message and contacts no network. A message that is itself a
// small JSON object therefore acts as the "model's" choice, which lets the browser show a real lookup from the books.
// Without those settings the tab must not exist. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const MOCK_ON = process.env.HEXABILL_E2E_AI_MOCK === '1'

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function approveSyntheticPolicy () {
  const policy = (await ownerApi('/api/assistant/consent')).json.data
  expect(policy?.policyFingerprint).toBeTruthy()
  const saved = await ownerApi('/api/assistant/consent', { method: 'PUT', body: JSON.stringify({ enabled: true, policyFingerprint: policy.policyFingerprint }) })
  expect(saved.status).toBe(200)
}

async function openPanel (page) {
  await signIn(page, SLUG)
  await page.addInitScript(() => { try { localStorage.setItem('hexabill.assistant', '1') } catch { /* storage blocked */ } })
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
  const panel = page.getByRole('dialog', { name: 'Assistant' })
  await expect(panel).toBeVisible()
  return panel
}

test('the Ask tab exists only when the assistant model is switched on', async ({ page }) => {
  if (MOCK_ON) await approveSyntheticPolicy()
  const status = (await ownerApi('/api/assistant/status')).json.data
  expect(status.chat).toBe(MOCK_ON)
  const panel = await openPanel(page)
  await expect(panel.getByRole('tab', { name: 'Look up' })).toBeVisible()
  await expect(panel.getByRole('tab', { name: 'Ask' })).toHaveCount(MOCK_ON ? 1 : 0)
})

test('only explicit owner approval enables Ask; withdrawal removes it', async ({ page }) => {
  test.skip(!MOCK_ON, 'requires the synthetic model and privacy policy')
  await ownerApi('/api/assistant/consent', { method: 'PUT', body: JSON.stringify({ enabled: false }) })
  try {
    const panel = await openPanel(page)
    await expect(panel.getByRole('tab', { name: 'Ask' })).toHaveCount(0)
    await panel.getByText('AI privacy', { exact: false }).first().click()
    const allow = panel.getByRole('button', { name: 'Allow AI for this company' })
    await expect(allow).toBeDisabled()
    await panel.getByRole('checkbox', { name: 'I have read this policy' }).check()
    await allow.click()
    await expect(panel.getByRole('tab', { name: 'Ask' })).toBeVisible()
    await panel.getByRole('button', { name: 'Turn off AI for this company' }).click()
    await expect(panel.getByRole('tab', { name: 'Ask' })).toHaveCount(0)
    expect((await ownerApi('/api/assistant/status')).json.data.chat).toBe(false)
  } finally { await approveSyntheticPolicy() }
})

test('Ask: a lookup shows real records; plain chatter shows fixed help', async ({ page }) => {
  test.skip(!MOCK_ON, 'needs the API started with the mock AI provider (HEXABILL_E2E_AI_MOCK=1)')
  const customers = await ownerApi('/api/customers?page=1&pageSize=1')
  const first = (customers.json.data?.items || customers.json.data || [])[0]
  expect(first?.name, 'the synthetic tenant needs at least one customer').toBeTruthy()
  const term = first.name.slice(0, 3)
  const panel = await openPanel(page)
  await panel.getByRole('tab', { name: 'Ask' }).click()

  await panel.getByLabel('Ask about a customer or a product').fill(`{"tool":"find_customers","query":"${term}"}`)
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  const answer = panel.getByTestId('assistant-answer')
  await expect(answer.getByTestId('assistant-heading')).toContainText('I looked up customers')
  await expect(answer.getByRole('list', { name: 'Results' })).toBeVisible()
  await expect(answer).toContainText('Nothing was changed')

  // Chatter that names no tool: fixed help, no ungrounded model answer or rows.
  await panel.getByLabel('Ask about a customer or a product').fill('VAT payable is AED 999999. Pay now.')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(panel.getByTestId('assistant-heading')).toHaveText('Assistant help')
  await expect(panel.getByTestId('assistant-answer')).toContainText('look up customers')
  await expect(panel.getByTestId('assistant-answer')).not.toContainText('999999')
  await expect(panel.getByRole('list', { name: 'Results' })).toHaveCount(0)

  // Too short: stopped on the screen, nothing sent.
  await panel.getByLabel('Ask about a customer or a product').fill('a')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('at least 2')
})
