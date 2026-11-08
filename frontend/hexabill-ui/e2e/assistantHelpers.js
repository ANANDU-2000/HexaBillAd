// Shared helpers for the assistant e2e specs: mocked /api/assistant/*, sign-in with the assistant switched on, open the agent.
import { expect } from '@playwright/test'
import { signIn, feOrigin } from './session.js'

export const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'

export const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

export const SUMMARY = { mode: 'tool', tool: 'dashboard_summary', query: 'summary', result: { asOf: '2026-11-08T10:42:00Z', data: [{ salesToday: 1250.5, collectionsToday: 800, purchasesToday: 300, expensesToday: 120, profitToday: 410.25, pendingBills: 3, pendingBillsAmount: 920, lowStockCount: 2 }] } }
export const CUSTOMER_SUGGESTION = { mode: 'suggestion', suggestion: { kind: 'new_customer', fields: { name: 'Agent UI Test Trading', phone: '0501234567' } } }
export const EXPENSE_SUGGESTION = { mode: 'suggestion', suggestion: { kind: 'new_expense', fields: { categoryName: 'Fuel', amount: '80', note: 'Agent UI test' } } }

/** Installs the assistant mocks. `chatReply` may be an object or a function(message) returning one. */
export async function mockAssistant (page, { chatReply = { mode: 'reply', text: 'ignored' }, chatDelay = 0, streamBody = null } = {}) {
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

export async function boot (page, { storage = {}, path: startPath = '/dashboard' } = {}) {
  await signIn(page, SLUG)
  await page.addInitScript((entries) => {
    try {
      localStorage.setItem('hexabill.assistant', '1')
      Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v))
    } catch { /* storage blocked */ }
  }, storage)
  await page.goto(`${feOrigin(SLUG)}${startPath}`, { waitUntil: 'networkidle' })
}

export const openAgent = async (page) => {
  await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'HexaBill Agent' })
  await expect(dialog).toBeVisible()
  return dialog
}

