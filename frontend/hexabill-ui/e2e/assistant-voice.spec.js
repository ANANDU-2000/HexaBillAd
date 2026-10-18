// Voice and suggested forms in the assistant. Runs against an API with the built-in MOCK provider (see assistant-chat.spec.js), which
// echoes a short message back, so a message that is itself a small JSON object acts as the model's choice. The browser's speech
// recognition and synthesis are replaced by fakes: a real microphone and real Malayalam recognition are NOT tested here.
// Proves: hold-to-talk only fills the text box; nothing is sent until Ask; a suggestion only pre-fills the normal form; saving still
// needs the server review and a confirm; voice can be switched off and survives a reload. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const MOCK_ON = process.env.HEXABILL_E2E_AI_MOCK === '1'

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const items = (json) => json.data?.items || json.data?.Items || json.data || []
const customersNamed = async (name) => items((await ownerApi(`/api/customers?page=1&pageSize=50&search=${encodeURIComponent(name)}`)).json).filter((c) => c.name === name)

const fakeSpeech = ({ transcript = 'find rice', error = null } = {}) => {
  window.__speech = { started: 0, lang: null, transcript, error, spoken: [] }
  window.SpeechRecognition = class {
    start () { window.__speech.started += 1; window.__speech.lang = this.lang }
    stop () {
      setTimeout(() => {
        if (window.__speech.error) this.onerror?.({ error: window.__speech.error })
        else this.onresult?.({ results: [[{ transcript: window.__speech.transcript }]] })
        this.onend?.()
      }, 20)
    }
    abort () {}
  }
  window.SpeechSynthesisUtterance = class { constructor (text) { this.text = text } }
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel () {}, speak (u) { window.__speech.spoken.push({ text: u.text, lang: u.lang }) } } })
}

async function openAsk (page, init) {
  await signIn(page, SLUG)
  await page.addInitScript(() => { try { localStorage.setItem('hexabill.assistant', '1') } catch { /* blocked */ } })
  if (init) await page.addInitScript(fakeSpeech, init)
  else await page.addInitScript(() => { for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: undefined, configurable: true }) })
  await page.goto(`${feOrigin(SLUG)}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
  const panel = page.getByRole('dialog', { name: 'Assistant' })
  await panel.getByRole('tab', { name: 'Ask' }).click()
  return panel
}

const hold = async (page, button) => {
  await button.hover()
  await page.mouse.down()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.up()
}

test.describe('with the mock assistant model', () => {
  test.skip(!MOCK_ON, 'needs the API started with the mock AI provider (HEXABILL_E2E_AI_MOCK=1)')

  test('hold to talk fills the box in the chosen language and sends nothing until Ask', async ({ page }) => {
    const sent = []
    page.on('request', (r) => { if (r.url().includes('/api/assistant/chat')) sent.push(r.url()) })
    const panel = await openAsk(page, { transcript: 'പുതിയ ഉപഭോക്താവ് അൽ നൂർ' })
    await expect(panel.getByTestId('voice-input')).toContainText('no audio and no transcript')
    await panel.getByLabel('Voice language').selectOption('ml')
    await hold(page, panel.getByRole('button', { name: 'Hold to talk' }))
    const box = panel.getByLabel('Ask about a customer or a product')
    await expect(box).toHaveValue('പുതിയ ഉപഭോക്താവ് അൽ നൂർ')
    expect(await page.evaluate(() => window.__speech.lang)).toBe('ml-IN')
    expect(sent).toHaveLength(0)
    // The words can be edited before they are sent; a second hold adds to them.
    await box.fill('പുതിയ ഉപഭോക്താവ് അൽ നൂർ ട്രേഡിംഗ്')
    expect(sent).toHaveLength(0)
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect.poll(() => sent.length).toBe(1)
  })

  test('a denied microphone is explained and typing still works', async ({ page }) => {
    const panel = await openAsk(page, { error: 'not-allowed' })
    await hold(page, panel.getByRole('button', { name: 'Hold to talk' }))
    await expect(panel.getByTestId('voice-problem')).toContainText('microphone is turned off')
    await panel.getByLabel('Ask about a customer or a product').fill('hello there')
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(panel.getByTestId('assistant-heading')).toHaveText('Assistant suggestion')
  })

  test('voice can be switched off, and stays off after a reload', async ({ page }) => {
    let panel = await openAsk(page, { transcript: 'x' })
    await panel.getByLabel('Use voice input').uncheck()
    await expect(panel.getByRole('button', { name: 'Hold to talk' })).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
    panel = page.getByRole('dialog', { name: 'Assistant' })
    await panel.getByRole('tab', { name: 'Ask' }).click()
    await expect(panel.getByLabel('Use voice input')).not.toBeChecked()
    await expect(panel.getByRole('button', { name: 'Hold to talk' })).toHaveCount(0)
  })

  test('a browser without speech support says so and typing works', async ({ page }) => {
    const panel = await openAsk(page, null)
    await expect(panel.getByTestId('voice-unsupported')).toBeVisible()
    await expect(panel.getByLabel('Ask about a customer or a product')).toBeVisible()
  })

  test('a suggested customer only pre-fills the form; it is saved only after the review and the confirm', async ({ page }) => {
    const name = `UXV ${String(Date.now()).slice(-8)}` // short: the mock model echoes only the first 60 characters of the message
    try {
      const panel = await openAsk(page, { transcript: 'x' })
      await panel.getByLabel('Ask about a customer or a product').fill(`{"tool":"new_customer","fields":{"name":"${name}"}}`)
      await panel.getByRole('button', { name: 'Ask', exact: true }).click()
      const suggestion = panel.getByTestId('assistant-suggestion')
      await expect(suggestion).toContainText(name)
      await expect(panel.getByTestId('assistant-answer')).toContainText('Nothing is saved')
      expect(await customersNamed(name)).toHaveLength(0)

      // Read it back aloud (fake synthesis).
      await panel.getByRole('button', { name: 'Read it back' }).click()
      const spoken = await page.evaluate(() => window.__speech.spoken)
      expect(spoken[0].text).toContain(name)
      expect(spoken[0].text).toContain('Check the form on screen')

      await panel.getByRole('button', { name: 'Open the form to check it' }).click()
      await expect(panel.getByTestId('prefill-note')).toContainText('Nothing is saved')
      await expect(panel.locator("#assistant-cust-name")).toHaveValue(name)
      expect(await customersNamed(name)).toHaveLength(0)

      // Review is the server's draft; still nothing created.
      await panel.getByRole('button', { name: /Review/ }).click()
      const confirm = panel.getByRole('button', { name: /Confirm and create/ })
      await expect(confirm).toBeEnabled()
      expect(await customersNamed(name)).toHaveLength(0)
      await confirm.dblclick() // a double tap still creates exactly one
      await expect.poll(async () => (await customersNamed(name)).length).toBe(1)
    } finally {
      for (const c of await customersNamed(name)) await ownerApi(`/api/customers/${c.id}`, { method: 'DELETE' })
    }
  })

  test('a suggested expense keeps Malayalam digits meaningful and leaves an unmatched category for the person', async ({ page }) => {
    const panel = await openAsk(page, { transcript: 'x' })
    await panel.getByLabel('Ask about a customer or a product').fill('{"tool":"new_expense","fields":{"amount":"൧൨൫"}}')
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(panel.getByTestId('assistant-suggestion')).toContainText('125')
    await panel.getByRole('button', { name: 'Open the form to check it' }).click()
    await expect(panel.getByTestId('prefill-note')).toContainText('amount and the category')
    await expect(panel.getByLabel(/^Amount/)).toHaveValue('125')
    await expect(panel.locator('#assistant-exp-category')).toHaveValue('') // no category was suggested: the person chooses
  })
})
