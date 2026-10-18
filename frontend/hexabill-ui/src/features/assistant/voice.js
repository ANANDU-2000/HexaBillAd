// Push-to-talk helpers for the assistant. Pure: the browser objects are passed in, so everything here can be tested without a microphone.
// Voice only fills the text box. It never sends anything, and nothing is acted on until the person presses Ask, reviews, and confirms.

export const VOICE_OPT_OUT_KEY = 'hexabill.voice'

export const VOICE_LANGUAGES = [
  { id: 'en', label: 'English', locale: 'en-GB' },
  { id: 'ml', label: 'Malayalam (മലയാളം)', locale: 'ml-IN' },
  { id: 'hi', label: 'Hindi (हिन्दी)', locale: 'hi-IN' },
  { id: 'ar', label: 'Arabic (العربية)', locale: 'ar-AE' },
]

export const localeFor = (id) => (VOICE_LANGUAGES.find((l) => l.id === id) || VOICE_LANGUAGES[0]).locale

export const recognitionCtor = (win = globalThis) => win?.SpeechRecognition || win?.webkitSpeechRecognition || null
export const voiceSupported = (win = globalThis) => recognitionCtor(win) != null
export const ttsSupported = (win = globalThis) => Boolean(win?.speechSynthesis && win?.SpeechSynthesisUtterance)

/** Voice is on unless the person switched it off in this browser. A blocked or missing storage never turns it off by accident. */
export function voiceOptedOut(storage = globalThis.localStorage) {
  try { return storage?.getItem(VOICE_OPT_OUT_KEY) === 'off' } catch { return false }
}

export function setVoiceOptedOut(optOut, storage = globalThis.localStorage) {
  try { storage?.setItem(VOICE_OPT_OUT_KEY, optOut ? 'off' : 'on') } catch { /* storage blocked: the choice lasts until the page closes */ }
}

/** New words go after what is already typed, on one line, never past the message limit. */
export function appendTranscript(existing, transcript, max = 500) {
  const spoken = (transcript || '').replace(/\s+/g, ' ').trim()
  if (!spoken) return existing || ''
  const joined = [(existing || '').trim(), spoken].filter(Boolean).join(' ')
  return joined.length > max ? joined.slice(0, max) : joined
}

const VOICE_ERRORS = {
  'not-allowed': 'The microphone is turned off for this site. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'The microphone is turned off for this site. Allow it in your browser settings, or type instead.',
  'no-speech': 'I did not hear anything. Hold the button, speak, then let go.',
  'audio-capture': 'No microphone was found. Type your request instead.',
  network: "The browser's speech service could not be reached. Type your request instead.",
  'language-not-supported': 'This browser cannot listen in that language. Choose another language or type instead.',
  aborted: '',
}

/** Plain words for a speech error; an empty string means nothing needs saying (the person simply let go). */
export function describeVoiceError(code) {
  if (code in VOICE_ERRORS) return VOICE_ERRORS[code]
  return 'Voice input did not work. Type your request instead.'
}

export const VOICE_PRIVACY_NOTE =
  "Voice uses your browser's speech service, which may send what you say to its provider. HexaBill keeps no audio and no transcript; only the words you send with Ask reach the assistant."

const spellDigits = (value) => String(value).replace(/\d/g, (d) => `${d} `).replace(/\s+/g, ' ').trim()

/**
 * Text to read back a suggested form so the person can hear every number, name and amount before confirming.
 * Phone numbers and amounts are spoken digit by digit. This is a convenience, not a record: the form on screen is what counts.
 */
export function readBackText(kind, fields = {}) {
  const parts = []
  if (kind === 'new_customer') {
    parts.push('New customer.')
    if (fields.name) parts.push(`Name: ${fields.name}.`)
    if (fields.phone) parts.push(`Phone: ${spellDigits(fields.phone)}.`)
    if (fields.email) parts.push(`Email: ${String(fields.email).replace('@', ' at ').replace(/\./g, ' dot ')}.`)
    if (fields.address) parts.push(`Address: ${fields.address}.`)
  } else if (kind === 'new_expense') {
    parts.push('New expense.')
    if (fields.categoryName) parts.push(`Category: ${fields.categoryName}.`)
    if (fields.amount) parts.push(`Amount: ${String(fields.amount).split('.').map(spellDigits).join(' point ')}.`)
    if (fields.date) parts.push(`Date: ${String(fields.date).split('-').map(spellDigits).join(', ')}.`)
    if (fields.note) parts.push(`Note: ${fields.note}.`)
  }
  parts.push('Check the form on screen before you confirm.')
  return parts.join(' ')
}
