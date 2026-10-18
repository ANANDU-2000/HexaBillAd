import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VOICE_LANGUAGES, localeFor, recognitionCtor, voiceSupported, ttsSupported, voiceOptedOut, setVoiceOptedOut, appendTranscript, describeVoiceError,
  readBackText, VOICE_PRIVACY_NOTE, VOICE_OPT_OUT_KEY,
} from '../src/features/assistant/voice.js'

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('the four first languages map to speech locales', () => {
  assert.deepEqual(VOICE_LANGUAGES.map((l) => l.id), ['en', 'ml', 'hi', 'ar'])
  assert.equal(localeFor('ml'), 'ml-IN')
  assert.equal(localeFor('hi'), 'hi-IN')
  assert.equal(localeFor('ar'), 'ar-AE')
  assert.equal(localeFor('xx'), 'en-GB') // an unknown id never breaks the button
})

test('support is detected from the browser object, standard or prefixed', () => {
  assert.equal(voiceSupported({}), false)
  assert.equal(voiceSupported({ SpeechRecognition: class {} }), true)
  assert.equal(voiceSupported({ webkitSpeechRecognition: class {} }), true)
  assert.equal(recognitionCtor(undefined), null)
  assert.equal(ttsSupported({}), false)
  assert.equal(ttsSupported({ speechSynthesis: {}, SpeechSynthesisUtterance: class {} }), true)
})

test('voice is on by default and the opt-out is remembered; blocked storage never switches it off', () => {
  const storage = memory()
  assert.equal(voiceOptedOut(storage), false)
  setVoiceOptedOut(true, storage)
  assert.equal(storage.getItem(VOICE_OPT_OUT_KEY), 'off')
  assert.equal(voiceOptedOut(storage), true)
  setVoiceOptedOut(false, storage)
  assert.equal(voiceOptedOut(storage), false)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(voiceOptedOut(blocked), false)
  assert.doesNotThrow(() => setVoiceOptedOut(true, blocked))
})

test('spoken words are added after the typed ones, tidily and within the limit', () => {
  assert.equal(appendTranscript('', ' find  rice '), 'find rice')
  assert.equal(appendTranscript('Find', 'rice stock'), 'Find rice stock')
  assert.equal(appendTranscript('keep', '   '), 'keep')
  assert.equal(appendTranscript(undefined, undefined), '')
  assert.equal(appendTranscript('x'.repeat(498), 'abcdef').length, 500)
  // Other scripts pass through untouched.
  assert.equal(appendTranscript('', 'പുതിയ ഉപഭോക്താവ്'), 'പുതിയ ഉപഭോക്താവ്')
})

test('speech errors are explained, and letting go is not an error', () => {
  assert.match(describeVoiceError('not-allowed'), /microphone is turned off/)
  assert.match(describeVoiceError('no-speech'), /did not hear/)
  assert.match(describeVoiceError('network'), /speech service/)
  assert.match(describeVoiceError('audio-capture'), /No microphone/)
  assert.match(describeVoiceError('language-not-supported'), /another language/)
  assert.equal(describeVoiceError('aborted'), '')
  assert.match(describeVoiceError('something-new'), /did not work/)
})

test('the privacy note says what is and is not kept', () => {
  assert.match(VOICE_PRIVACY_NOTE, /speech service/)
  assert.match(VOICE_PRIVACY_NOTE, /no audio and no transcript/)
})

test('read-back speaks numbers digit by digit and always says to check the screen', () => {
  const customer = readBackText('new_customer', { name: 'Al Noor', phone: '0501234567', email: 'a@b.example' })
  assert.match(customer, /Name: Al Noor/)
  assert.match(customer, /Phone: 0 5 0 1 2 3 4 5 6 7\./)
  assert.match(customer, /a at b dot example/)
  assert.match(customer, /Check the form on screen/)
  const expense = readBackText('new_expense', { categoryName: 'Fuel', amount: '125.5', date: '2026-10-17' })
  assert.match(expense, /Amount: 1 2 5 point 5\./)
  assert.match(expense, /Date: 2 0 2 6, 1 0, 1 7\./)
  assert.match(readBackText('other', {}), /^Check the form/)
})
