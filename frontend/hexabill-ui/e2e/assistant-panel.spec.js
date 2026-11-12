// Assistant panel (rewritten for the agent shell, UX-E01/E04). Visibility switches, width modes, Escape, and the confirm rules
// for customer and expense cards: an uncertain server failure is never offered as a blind retry, and Cancel saves nothing.
// /api/assistant/* is mocked (no model, no provider). Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { feOrigin, signIn, apiLogin, API, EDGE } from './session.js'
import { mockAssistant, boot, openAgent, SLUG, CUSTOMER_SUGGESTION, EXPENSE_SUGGESTION } from './assistantHelpers.js'

test.describe('visibility', () => {
  const signedIn = async (page, flag) => {
    await mockAssistant(page)
    await signIn(page, SLUG)
    await page.addInitScript((value) => { try { if (value === null) localStorage.removeItem('hexabill.assistant'); else localStorage.setItem('hexabill.assistant', value) } catch { /* storage blocked */ } }, flag)
    await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  }

  test('the assistant button is there by default', async ({ page }) => {
    await signedIn(page, null)
    await expect(page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first()).toBeVisible()
  })

  test('the browser switch hexabill.assistant=0 hides it', async ({ page }) => {
    await signedIn(page, '0')
    await expect(page.getByRole('button', { name: 'Open assistant' })).toHaveCount(0)
  })
})

test.describe('panel', () => {
  test('width mode matches the viewport; Escape closes it', async ({ page }) => {
    await mockAssistant(page)
    await boot(page)
    const dialog = await openAgent(page)
    const vp = page.viewportSize()
    const box = await dialog.boundingBox()
    if (vp.width >= 1024) {
      await expect(dialog).toHaveAttribute('data-mode', 'drawer')
      expect(Math.round(box.x + box.width)).toBe(vp.width) // docked to the right edge
    } else if (vp.width >= 700) {
      await expect(dialog).toHaveAttribute('data-mode', 'sheet')
    } else {
      await expect(dialog).toHaveAttribute('data-mode', 'phone')
      expect(Math.round(box.width)).toBe(vp.width)
      expect(Math.round(box.height)).toBe(vp.height)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  test('new customer: an uncertain confirm failure is not offered as a retry and says to check the list; Cancel saves nothing', async ({ page }) => {
    const calls = await mockAssistant(page, { chatReply: CUSTOMER_SUGGESTION })
    await page.route(/\/api\/assistant\/drafts\/customer$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'dc9', status: 'Draft', errors: [], payloadHash: 'h' } }) }))
    const confirms = []
    await page.route(/\/api\/assistant\/drafts\/[^/]+\/confirm$/, (route) => {
      confirms.push(JSON.parse(route.request().postData() || '{}'))
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
    })
    await boot(page)
    const dialog = await openAgent(page)
    const input = dialog.getByLabel('Message the agent')
    await input.fill('add customer Agent UI Test Trading')
    await input.press('Enter')
    const card = dialog.getByTestId('action-customer')
    await card.getByRole('button', { name: 'Confirm and add' }).click()
    await expect(card.getByRole('alert')).toContainText('not certain')
    await expect(card.getByRole('button', { name: 'Confirm and add' })).toBeEnabled()
    expect(confirms.length).toBe(1)
    expect(confirms[0].idempotencyKey).toMatch(/^assistant-/)
    // Cancel after a failure: nothing else is sent.
    await card.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toContainText('Cancelled. Nothing was saved')
    expect(confirms.length).toBe(1)
  })

  test('new expense: a 400 refusal names the reason and keeps the form; the Expenses hand-off stays on the card', async ({ page }) => {
    const calls = await mockAssistant(page, { chatReply: EXPENSE_SUGGESTION })
    await page.route(/\/api\/assistant\/drafts\/expense$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'de9', status: 'Draft', errors: [{ field: 'amount', message: 'Amount must be greater than 0.' }], payloadHash: 'h' } }) }))
    await boot(page)
    const dialog = await openAgent(page)
    const input = dialog.getByLabel('Message the agent')
    await input.fill('record 80 fuel expense')
    await input.press('Enter')
    const card = dialog.getByTestId('action-expense')
    await card.getByRole('button', { name: 'Confirm and record' }).click()
    await expect(card.getByRole('alert')).toContainText('Amount must be greater than 0.')
    await expect(card.getByLabel('Amount (AED) *')).toHaveValue('80')
    expect(calls.confirm.length).toBe(0)
  })
})

test('"Ask agent about this" on a customer ledger opens the agent with the reference pre-filled, not sent', async ({ page }) => {
  const calls = await mockAssistant(page)
  const name = `Ask Agent Buyer ${Date.now()}`
  const made = await fetch(`${API}/api/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await apiLogin(SLUG)).token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }, body: JSON.stringify({ name, phone: '05' + String(Date.now()).slice(-8) }) })
  expect(made.status).toBeLessThan(300)
  const id = (await made.json()).data?.id
  await boot(page, { path: `/ledger?customerId=${id}` })
  await page.getByRole('button', { name: `More actions for ${name}` }).filter({ visible: true }).first().click()
  await page.getByRole('menuitem', { name: 'Ask agent about this' }).click()
  const dialog = page.getByRole('dialog', { name: 'HexaBill Agent' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Message the agent')).toHaveValue(`Tell me about customer ${name}`)
  expect(calls.chat).toEqual([])
})
