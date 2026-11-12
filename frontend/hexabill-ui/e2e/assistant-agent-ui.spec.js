// UX-E01..E05: agent shell (drawer / sheet / phone / full page), empty state, tool card, action cards (draft -> confirm),
// typing indicator, grounded replies (D-A02), streaming adapter, voice mode with the scripted mock session.
// Only /api/assistant/* and /api/expenses/categories are intercepted. Synthetic local tenant only.
// Run: npx playwright test e2e/assistant-agent-ui.spec.js --project=d1440 --project=m360
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/uiux/evidence/2026-11-08')
fs.mkdirSync(EVIDENCE, { recursive: true })
const shot = async (page, name, info) => page.screenshot({ path: path.join(EVIDENCE, `${name.replace('<vp>', info.project.name)}.png`) })

const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

const SUMMARY = { mode: 'tool', tool: 'dashboard_summary', query: 'summary', result: { asOf: '2026-11-08T10:42:00Z', data: [{ salesToday: 1250.5, collectionsToday: 800, purchasesToday: 300, expensesToday: 120, profitToday: 410.25, pendingBills: 3, pendingBillsAmount: 920, lowStockCount: 2 }] } }
const CUSTOMER_SUGGESTION = { mode: 'suggestion', suggestion: { kind: 'new_customer', fields: { name: 'Agent UI Test Trading', phone: '0501234567' } } }
const EXPENSE_SUGGESTION = { mode: 'suggestion', suggestion: { kind: 'new_expense', fields: { categoryName: 'Fuel', amount: '80', note: 'Agent UI test' } } }

/** Installs the assistant mocks. `chatReply` may be an object or a function(message) returning one. */
async function mockAssistant (page, { chatReply = { mode: 'reply', text: 'ignored' }, chatDelay = 0, streamBody = null } = {}) {
  const calls = { chat: [], draftCustomer: [], draftExpense: [], confirm: [], stream: 0 }
  await page.route((url) => url.pathname.startsWith('/api/assistant/') || url.pathname === '/api/expenses/categories', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname
    const body = req.postData() ? JSON.parse(req.postData()) : {}
    if (p.endsWith('/assistant/status')) return route.fulfill(ok({ chat: true }))
    if (p.endsWith('/assistant/consent')) return route.fulfill(ok({ enabled: true, canManage: true, policyFingerprint: 'fp', policyNotice: 'Test policy.' }))
    if (p.endsWith('/expenses/categories')) return route.fulfill(ok([{ id: 11, name: 'Fuel' }, { id: 12, name: 'Office' }]))
    if (p.endsWith('/assistant/chat/stream')) {
      calls.stream += 1
      if (!streamBody) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: streamBody })
    }
    if (p.endsWith('/assistant/chat')) {
      calls.chat.push(body.message)
      if (chatDelay) await new Promise((r) => setTimeout(r, chatDelay))
      return route.fulfill(ok(typeof chatReply === 'function' ? chatReply(body.message) : chatReply))
    }
    if (p.endsWith('/drafts/customer')) { calls.draftCustomer.push(body); return route.fulfill(ok({ id: 'dc1', status: 'Draft', errors: [], payloadHash: 'hash-c' })) }
    if (p.endsWith('/drafts/expense')) { calls.draftExpense.push(body); return route.fulfill(ok({ id: 'de1', status: 'Draft', errors: [], payloadHash: 'hash-e' })) }
    if (p.endsWith('/confirm')) { calls.confirm.push({ p, body }); return route.fulfill(ok({ result: { customerId: 4242 } })) }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  return calls
}

async function boot (page, { storage = {}, path: startPath = '/dashboard' } = {}) {
  await signIn(page, SLUG)
  await page.addInitScript((entries) => {
    try {
      localStorage.setItem('hexabill.assistant', '1')
      Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v))
    } catch { /* storage blocked */ }
  }, storage)
  await page.goto(`${feOrigin(SLUG)}${startPath}`, { waitUntil: 'networkidle' })
}

const openAgent = async (page) => {
  await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'HexaBill Agent' })
  await expect(dialog).toBeVisible()
  return dialog
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

test('E01/E02 shell by width, empty state, Esc, no emoji', async ({ page }, info) => {
  await mockAssistant(page)
  await boot(page)
  const dialog = await openAgent(page)
  const vp = page.viewportSize()
  const box = await dialog.boundingBox()
  if (vp.width >= 1024) {
    await expect(dialog).toHaveAttribute('data-mode', 'drawer')
    expect(Math.round(box.width)).toBe(420)
    expect(Math.round(box.x + box.width)).toBe(vp.width)
    // pushes content: main content ends before the drawer starts
    const main = await page.locator('#main-content').boundingBox()
    expect(main.x + main.width).toBeLessThanOrEqual(box.x + 1)
  } else if (vp.width >= 700) {
    await expect(dialog).toHaveAttribute('data-mode', 'sheet')
  } else {
    await expect(dialog).toHaveAttribute('data-mode', 'phone')
    expect(Math.round(box.width)).toBe(vp.width)
    expect(Math.round(box.height)).toBe(vp.height)
  }
  await expect(dialog.getByRole('heading', { name: 'HexaBill Agent' })).toBeVisible()
  await expect(dialog.getByTestId('assistant-empty')).toContainText(/Good (morning|afternoon|evening)/)
  await expect(dialog.getByRole('button', { name: /Today's summary/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Overdue customers/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Low stock/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Record a payment/ })).toBeVisible()
  expect(EMOJI.test(await dialog.innerText())).toBe(false)
  await shot(page, 'E02-<vp>-empty-state', info)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('E01 sheet at 752x1254 and drawer at 1254x752', async ({ page }, info) => {
  test.skip(info.project.name !== 'd1440', 'viewport set inside the test')
  await mockAssistant(page)
  await page.setViewportSize({ width: 752, height: 1254 })
  await boot(page)
  let dialog = await openAgent(page)
  await expect(dialog).toHaveAttribute('data-mode', 'sheet')
  const box = await dialog.boundingBox()
  expect(Math.round(box.height)).toBe(Math.round(1254 * 0.9))
  await expect(dialog.getByTestId('sheet-handle')).toBeVisible()
  await shot(page, 'E01-752x1254-sheet', info)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.setViewportSize({ width: 1254, height: 752 })
  dialog = await openAgent(page)
  await expect(dialog).toHaveAttribute('data-mode', 'drawer')
  await shot(page, 'E01-1254x752-drawer', info)
})

test('E01 Ctrl+J toggles, open state persists per tenant, Expand opens /assistant with the thread', async ({ page }, info) => {
  test.skip(info.project.name !== 'd1440', 'desktop-only behaviour')
  await mockAssistant(page, { chatReply: SUMMARY })
  await boot(page)
  const dialog = page.getByRole('dialog', { name: 'HexaBill Agent' })
  await expect(dialog).toBeHidden()
  await page.keyboard.press('Control+j')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Today's summary/ }).click()
  await expect(dialog.getByTestId('tool-summary')).toBeVisible()

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('dialog', { name: 'HexaBill Agent' })).toBeVisible() // persisted
  await page.keyboard.press('Control+j')
  await expect(page.getByRole('dialog', { name: 'HexaBill Agent' })).toBeHidden()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('dialog', { name: 'HexaBill Agent' })).toBeHidden() // closed stays closed

  await page.keyboard.press('Control+j')
  const d2 = page.getByRole('dialog', { name: 'HexaBill Agent' })
  await expect(d2).toBeVisible()
  await d2.getByRole('button', { name: 'Expand to full view' }).click()
  await expect(page).toHaveURL(/\/assistant$/)
  await expect(page.getByTestId('assistant-page')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'HexaBill Agent' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Conversations' })).toBeVisible()
  const col = await page.getByRole('region', { name: 'HexaBill Agent' }).boundingBox()
  expect(col.width).toBeLessThanOrEqual(760)
  await shot(page, 'E01-<vp>-full-view', info)
})

test('E02 tool result renders as a compact card with an as-of time', async ({ page }, info) => {
  await mockAssistant(page, { chatReply: SUMMARY })
  await boot(page)
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: /Today's summary/ }).click()
  const card = dialog.getByTestId('tool-summary')
  await expect(card).toBeVisible()
  await expect(card).toContainText('as of')
  await expect(card).toContainText('1,250.50 AED')
  await expect(dialog.getByTestId('assistant-thread')).toBeVisible()
  await shot(page, 'E02-<vp>-tool-result', info)
})

test('E03 typing indicator while a request is pending', async ({ page }, info) => {
  await mockAssistant(page, { chatReply: SUMMARY, chatDelay: 1500 })
  await boot(page)
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: /Today's summary/ }).click()
  await expect(dialog.getByTestId('typing-indicator')).toBeVisible()
  await expect(dialog.getByTestId('agent-state')).toContainText('Thinking')
  await shot(page, 'E03-<vp>-thinking', info)
  await expect(dialog.getByTestId('tool-summary')).toBeVisible()
  await expect(dialog.getByTestId('typing-indicator')).toHaveCount(0)
})

test('E03 streaming adapter: events fold into the final answer; a missing endpoint falls back to the single response', async ({ page }) => {
  const stream = [
    { type: 'tool', name: 'dashboard_summary', status: 'running' },
    { type: 'token', text: 'hidden model text' },
    { type: 'done', reply: SUMMARY },
  ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  const calls = await mockAssistant(page, { streamBody: stream, chatReply: { mode: 'reply', text: 'x' } })
  await boot(page, { storage: { 'hexabill.assistant.stream': '1' } })
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: /Today's summary/ }).click()
  await expect(dialog.getByTestId('tool-summary')).toBeVisible()
  await expect(dialog).not.toContainText('hidden model text')
  expect(calls.stream).toBe(1)
  expect(calls.chat).toEqual([])
})

test('E03 stream endpoint missing: falls back to /assistant/chat', async ({ page }) => {
  const calls = await mockAssistant(page, { streamBody: null, chatReply: SUMMARY })
  await boot(page, { storage: { 'hexabill.assistant.stream': '1' } })
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: /Today's summary/ }).click()
  await expect(dialog.getByTestId('tool-summary')).toBeVisible()
  expect(calls.stream).toBe(1)
  expect(calls.chat.length).toBe(1)
})

test('D-A02: ungrounded reply text stays hidden; grounded reply shows text with sources', async ({ page }, info) => {
  let grounded = false
  await mockAssistant(page, {
    chatReply: () => (grounded
      ? { mode: 'reply', text: 'You have 3 overdue invoices.', grounded: true, asOf: '2026-11-08T10:00:00Z', sources: ['Sales ledger', { label: 'Customer 12', href: '/customers/12' }] }
      : { mode: 'reply', text: 'VAT payable is AED 999999.' }),
  })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('how are we doing')
  await input.press('Enter')
  await expect(dialog).toContainText('look up customers')
  await expect(dialog).not.toContainText('999999')
  grounded = true
  await input.fill('how many overdue')
  await input.press('Enter')
  await expect(dialog).toContainText('You have 3 overdue invoices.')
  await expect(dialog).toContainText('Sources:')
  await expect(dialog.getByRole('link', { name: 'Customer 12' })).toHaveAttribute('href', '/customers/12')
  await shot(page, 'E02-<vp>-grounded-reply', info)
})

test('E04 customer card: draft -> confirm with payloadHash + idempotency key, success link; Cancel saves nothing', async ({ page }, info) => {
  const calls = await mockAssistant(page, { chatReply: CUSTOMER_SUGGESTION })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('add customer Agent UI Test Trading')
  await input.press('Enter')
  const card = dialog.getByTestId('action-customer')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Nothing is saved until you confirm.')
  await expect(card.getByRole('button', { name: 'Confirm and add' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Edit in full form' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expect(card.getByLabel('Customer name *')).toHaveValue('Agent UI Test Trading')
  await card.getByLabel('Phone').fill('0509999999') // inline edit
  await shot(page, 'E04-<vp>-customer-card', info)
  expect(calls.confirm).toEqual([])
  await card.getByRole('button', { name: 'Confirm and add' }).click()
  await expect(dialog.getByTestId('action-customer-success')).toBeVisible()
  expect(calls.draftCustomer.length).toBe(1)
  expect(calls.draftCustomer[0].phone).toBe('0509999999')
  expect(calls.confirm.length).toBe(1)
  expect(calls.confirm[0].body.payloadHash).toBe('hash-c')
  expect(calls.confirm[0].body.idempotencyKey).toMatch(/^assistant-/)
  await expect(dialog.getByRole('link', { name: 'Open customer' })).toHaveAttribute('href', '/customers/4242')
  await shot(page, 'E04-<vp>-customer-success', info)

  // Cancel path: nothing is sent
  await input.fill('add another customer')
  await input.press('Enter')
  const cards = dialog.getByTestId('action-customer')
  await expect(cards).toHaveCount(1)
  await cards.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toContainText('Cancelled. Nothing was saved')
  expect(calls.draftCustomer.length).toBe(1)
  expect(calls.confirm.length).toBe(1)
})

test('E04 expense card: category matched from the suggestion, draft -> confirm', async ({ page }, info) => {
  const calls = await mockAssistant(page, { chatReply: EXPENSE_SUGGESTION })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('record 80 fuel expense')
  await input.press('Enter')
  const card = dialog.getByTestId('action-expense')
  await expect(card).toBeVisible()
  await expect(card.getByLabel('Category *')).toHaveValue('11')
  await expect(card.getByLabel('Amount (AED) *')).toHaveValue('80')
  await card.getByRole('button', { name: 'Confirm and record' }).click()
  await expect(dialog.getByTestId('action-expense-success')).toContainText('80.00 AED')
  expect(calls.draftExpense[0]).toMatchObject({ categoryId: 11, amount: 80 })
  expect(calls.confirm[0].body.payloadHash).toBe('hash-e')
  await shot(page, 'E04-<vp>-expense-success', info)
})

test('E04 payment card hands off to Payments and never posts money itself', async ({ page }) => {
  const posted = []
  await page.route((url) => url.pathname === '/api/payments' || url.pathname.startsWith('/api/payments/'), (route) => {
    if (route.request().method() === 'POST') posted.push(route.request().url())
    return route.continue()
  })
  await mockAssistant(page, { chatReply: { mode: 'suggestion', suggestion: { kind: 'new_payment', fields: { customerName: 'Al Noor', amount: '500' } } } })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('received 500 from Al Noor')
  await input.press('Enter')
  const card = dialog.getByTestId('action-payment')
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'Review in Payments' })).toBeVisible()
  await card.getByRole('button', { name: 'Review in Payments' }).click()
  await expect(page).toHaveURL(/\/payments/)
  expect(posted).toEqual([])
})

test('E05 voice mode: consent, then every state from the scripted mock session, then Switch to text keeps the prepared card', async ({ page }, info) => {
  await mockAssistant(page)
  await boot(page, { storage: { 'hexabill.assistant.voice': 'mock' } })
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: 'Voice mode' }).click()
  await expect(dialog.getByTestId('voice-consent')).toBeVisible()
  await shot(page, 'E05-<vp>-consent', info)
  await dialog.getByRole('button', { name: 'Allow microphone' }).click()
  const state = dialog.getByTestId('voice-state')
  await expect(state).toHaveText('Listening')
  await expect(dialog.getByTestId('voice-orb')).toHaveAttribute('data-state', 'listening')
  await shot(page, 'E05-<vp>-listening', info)
  await expect(state).toHaveText('Thinking')
  await shot(page, 'E05-<vp>-thinking', info)
  await expect(state).toHaveText('Speaking')
  await expect(dialog.getByTestId('voice-transcript')).toContainText('Received five hundred dirhams from Al Noor')
  await expect(dialog.getByTestId('voice-transcript')).toContainText('I prepared a payment of 500 AED')
  await expect(dialog).toContainText('Voice by mock-voice')
  await shot(page, 'E05-<vp>-speaking', info)
  await dialog.getByRole('button', { name: 'Mute' }).click()
  await expect(state).toHaveText('Muted')
  await dialog.getByRole('button', { name: 'Unmute' }).click()
  await dialog.getByRole('button', { name: 'Switch to text' }).click()
  await expect(dialog.getByTestId('action-payment')).toBeVisible()
  await expect(dialog.getByTestId('action-payment').getByLabel('Customer *')).toHaveValue('Al Noor')
})

test('E05 push-to-talk stays when no voice flag is set (no Voice mode button)', async ({ page }) => {
  await mockAssistant(page)
  await boot(page)
  const dialog = await openAgent(page)
  await expect(dialog.getByRole('button', { name: 'Voice mode' })).toHaveCount(0)
  await expect(dialog.getByLabel('Message the agent')).toBeVisible()
})
