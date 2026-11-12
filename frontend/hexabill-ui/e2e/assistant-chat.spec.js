// Assistant chat (rewritten for the agent shell, UX-E02/D-A02). Lookups render as cards from the books; plain model text is hidden
// unless the server marks the reply grounded; a route answer links to the Route Map. /api/assistant/* is mocked. Synthetic tenant only.
import { test, expect } from '@playwright/test'
import { mockAssistant, boot, openAgent } from './assistantHelpers.js'

const asOf = '2026-11-08T10:00:00Z'
const customerLookup = (query) => ({
  mode: 'tool', tool: 'find_customers', query,
  result: { asOf, data: [{ id: 7, name: 'Ahmed Trading', phone: '0501112222', balance: 120 }] },
})
const routeLookup = {
  mode: 'tool', tool: 'route_summary', query: 'all',
  result: { asOf, data: [{ routeId: 3, customerId: null, name: 'North Route', stops: 4, visitedToday: 1, outstandingTotal: 100, overdueTotal: 20, overdueCustomers: 1 }] },
}

test('a lookup shows real records as a card with an as-of time; plain chatter shows fixed help, never the model text', async ({ page }) => {
  await mockAssistant(page, {
    chatReply: (message) => (message.includes('Ahm') ? customerLookup('Ahm') : { mode: 'reply', text: 'VAT payable is AED 999999. Pay now.' }),
  })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')

  await input.fill('find customer Ahm')
  await input.press('Enter')
  const card = dialog.getByTestId('tool-result')
  await expect(card).toContainText('Ahmed Trading')
  await expect(card).toContainText('as of')
  await expect(dialog).toContainText('I looked up customers for “Ahm”.')

  await input.fill('what is my vat')
  await input.press('Enter')
  await expect(dialog).toContainText('look up customers')
  await expect(dialog).not.toContainText('999999')
})

test('a route answer lists routes from the books and "Map pin" opens the Route Map', async ({ page }) => {
  await mockAssistant(page, { chatReply: routeLookup })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('which routes are overdue')
  await input.press('Enter')
  const row = dialog.getByTestId('tool-result')
  await expect(row).toContainText('North Route')
  await row.getByRole('link', { name: 'Map pin' }).click()
  await expect(page).toHaveURL(/\/route-map\?route=3/)
  await expect(page.getByTestId('route-map-page')).toBeVisible()
})

test('a grounded reply shows its text with sources; a reply without the flag keeps the fixed help', async ({ page }) => {
  await mockAssistant(page, {
    chatReply: (message) => (message.includes('grounded')
      ? { mode: 'reply', text: 'You have 3 overdue invoices.', grounded: true, asOf, sources: ['Sales ledger', { label: 'Customer 12', href: '/customers/12' }] }
      : { mode: 'reply', text: 'Unverified claim 555.' }),
  })
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')

  await input.fill('plain question')
  await input.press('Enter')
  await expect(dialog).toContainText('look up customers')
  await expect(dialog).not.toContainText('555')

  await input.fill('grounded question')
  await input.press('Enter')
  await expect(dialog).toContainText('You have 3 overdue invoices.')
  await expect(dialog).toContainText('Sources:')
  await expect(dialog.getByRole('link', { name: 'Customer 12' })).toHaveAttribute('href', '/customers/12')
})

test('a message under 2 characters is refused on screen and nothing is sent', async ({ page }) => {
  const calls = await mockAssistant(page)
  await boot(page)
  const dialog = await openAgent(page)
  const input = dialog.getByLabel('Message the agent')
  await input.fill('a')
  await input.press('Enter')
  await expect(page.getByText('Type at least 2 characters.')).toBeVisible()
  expect(calls.chat).toEqual([])
})
