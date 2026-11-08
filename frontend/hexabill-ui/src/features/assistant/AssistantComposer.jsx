import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Mic, Send, Volume2 } from '../../components/ui/icons'
import { CHAT_MAX_CHARS } from './assistantChat'
import { CHIPS } from './assistantUi'
import { ICON_BY_ID } from './AssistantThread'
import { appendTranscript, describeVoiceError, localeFor, recognitionCtor } from './voice'

/** Existing browser push-to-talk: fills the box only; nothing is sent or acted on until the person presses Send. */
function PushToTalk ({ language, onTranscript }) {
  const [listening, setListening] = useState(false)
  const recognizer = useRef(null)
  const Ctor = recognitionCtor(globalThis)

  useEffect(() => () => { try { recognizer.current?.abort?.() } catch { /* already stopped */ } }, [])
  if (!Ctor) return null

  const toggle = () => {
    if (recognizer.current) { try { recognizer.current.stop() } catch { /* ignore */ } return }
    const rec = new Ctor()
    rec.lang = localeFor(language)
    rec.interimResults = false
    rec.continuous = false
    rec.maxAlternatives = 1
    let heard = ''
    rec.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0]?.transcript || '').join(' ') }
    rec.onerror = (e) => { const msg = describeVoiceError(e?.error); if (msg) toast.error(msg) }
    rec.onend = () => { recognizer.current = null; setListening(false); if (heard.trim()) onTranscript(heard) }
    recognizer.current = rec
    try { rec.start(); setListening(true) } catch { recognizer.current = null; setListening(false) }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Stop listening' : 'Speak your request'}
      aria-pressed={listening}
      title={listening ? 'Listening. Tap to finish' : 'Tap to speak'}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? 'bg-error text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
    >
      <Mic className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}

export default function AssistantComposer ({ onSend, sending, language, showChips, prefill, onPrefillUsed, onOpenVoice, voiceLabel = 'Voice mode' }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (prefill == null) return
    setText(String(prefill).slice(0, CHAT_MAX_CHARS))
    onPrefillUsed?.()
    inputRef.current?.focus()
  }, [prefill, onPrefillUsed])

  const submit = async (e) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setText('')
    await onSend(value)
  }

  return (
    <footer className="border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {showChips && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2" role="group" aria-label="Quick requests">
          {CHIPS.map((c) => {
            const Icon = ICON_BY_ID[c.icon]
            return (
              <button
                key={c.id}
                type="button"
                disabled={sending}
                onClick={() => onSend(c.prompt)}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 text-neutral-600" aria-hidden="true" /> {c.label}
              </button>
            )
          })}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 p-3">
        <PushToTalk language={language} onTranscript={(spoken) => setText((cur) => appendTranscript(cur, spoken, CHAT_MAX_CHARS))} />
        <input
          ref={inputRef}
          type="text"
          aria-label="Message the agent"
          className="min-h-10 flex-1 rounded-full border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Ask or tell the agent what to do"
          value={text}
          maxLength={CHAT_MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
        />
        {onOpenVoice && (
          <button type="button" onClick={onOpenVoice} aria-label={voiceLabel} title={voiceLabel} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50">
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </footer>
  )
}
