// Push-to-talk in the agent composer (rewritten for the agent shell, UX-E05 fallback). The browser's speech recognition is replaced by a
// fake: a real microphone and real Malayalam recognition are NOT tested here. Proves: the mic fills the text box only, nothing is sent until
// Send, a denied microphone is explained, and with no speech API there is no mic button. The voice mode (LiveKit or scripted mock) is in
// assistant-agent-ui.spec.js. /api/assistant/* is mocked. Synthetic local tenant only.
import { test, expect } from '@playwright/test'
import { mockAssistant, boot, openAgent } from './assistantHelpers.js'

const fakeSpeech = ({ transcript = 'find rice', error = null } = {}) => {
  window.__speech = { started: 0, lang: null, transcript, error }
  window.SpeechRecognition = class {
    start () {
      window.__speech.started += 1
      window.__speech.lang = this.lang
      if (window.__speech.error) setTimeout(() => { this.onerror?.({ error: window.__speech.error }); this.onend?.() }, 20)
    }
    stop () {
      setTimeout(() => {
        if (window.__speech.error) this.onerror?.({ error: window.__speech.error })
        else this.onresult?.({ results: [[{ transcript: window.__speech.transcript }]] })
        this.onend?.()
      }, 20)
    }
    abort () {}
  }
}

const noSpeech = () => {
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: undefined, configurable: true })
}

test('the mic fills the box and sends nothing until Send', async ({ page }) => {
  const calls = await mockAssistant(page, { chatReply: { mode: 'reply', text: 'x' } })
  await page.addInitScript(fakeSpeech, { transcript: 'find rice' })
  await boot(page)
  const dialog = await openAgent(page)
  const mic = dialog.getByRole('button', { name: 'Speak your request' })
  await mic.click()
  await expect(dialog.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Stop listening' }).click()
  const box = dialog.getByLabel('Message the agent')
  await expect(box).toHaveValue('find rice')
  expect(await page.evaluate(() => window.__speech.started)).toBe(1)
  expect(calls.chat).toEqual([])
  await dialog.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => calls.chat.length).toBe(1)
  expect(calls.chat[0]).toBe('find rice')
})

test('a denied microphone is explained and typing still works', async ({ page }) => {
  const calls = await mockAssistant(page, { chatReply: { mode: 'reply', text: 'x' } })
  await page.addInitScript(fakeSpeech, { error: 'not-allowed' })
  await boot(page)
  const dialog = await openAgent(page)
  await dialog.getByRole('button', { name: 'Speak your request' }).click()
  await expect(page.getByText('The microphone is turned off for this site.')).toBeVisible()
  await dialog.getByLabel('Message the agent').fill('hello there')
  await dialog.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => calls.chat.length).toBe(1)
})

test('with no speech API there is no microphone button and typing still works', async ({ page }) => {
  const calls = await mockAssistant(page, { chatReply: { mode: 'reply', text: 'x' } })
  await page.addInitScript(noSpeech)
  await boot(page)
  const dialog = await openAgent(page)
  await expect(dialog.getByRole('button', { name: 'Speak your request' })).toHaveCount(0)
  await dialog.getByLabel('Message the agent').fill('hello there')
  await dialog.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => calls.chat.length).toBe(1)
})
