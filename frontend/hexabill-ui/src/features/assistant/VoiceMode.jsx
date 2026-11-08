import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, MessageSquare } from '../../components/ui/icons'
import { applyTranscript, hasVoiceConsent, saveVoiceConsent } from './voiceSession'

const STATE_TEXT = {
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  ended: 'Call ended',
  error: 'Voice is not available',
}

/** CSS-only orb. Motion is dropped for reduced-motion users; the state is always also written as text. */
export function Orb ({ state }) {
  const ring = {
    listening: 'motion-safe:animate-pulse border-primary-600',
    thinking: 'motion-safe:animate-spin border-dashed border-neutral-500',
    speaking: 'border-primary-600',
    connecting: 'motion-safe:animate-pulse border-neutral-400',
    ended: 'border-neutral-300',
    error: 'border-error',
  }[state] || 'border-neutral-300'
  return (
    <div className="relative flex h-32 w-32 items-center justify-center" data-testid="voice-orb" data-state={state} aria-hidden="true">
      {state === 'speaking' && <span className="absolute inset-0 rounded-full bg-primary-100 motion-safe:animate-ping" />}
      <span className={`absolute inset-2 rounded-full border-4 ${ring}`} />
      <span className={`relative flex h-16 w-16 items-center justify-center rounded-full ${state === 'error' ? 'bg-error-bg text-error-fg' : 'bg-neutral-900 text-white'}`}>
        {state === 'ended' || state === 'error' ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </span>
    </div>
  )
}

function Consent ({ onAccept, onDecline }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-4 text-sm text-neutral-900" data-testid="voice-consent">
      <h3 className="text-base font-semibold">Use your microphone?</h3>
      <ul className="list-disc space-y-1 pl-5 text-neutral-800">
        <li>The microphone is on only while this voice screen is open. Press End to stop it.</li>
        <li>Your voice goes to the voice service your company approved. HexaBill keeps no audio.</li>
        <li>The agent can prepare things for you, but nothing is saved until you confirm it on screen.</li>
      </ul>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onAccept} className="min-h-10 flex-1 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">Allow microphone</button>
        <button type="button" onClick={onDecline} className="min-h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50">Not now</button>
      </div>
    </div>
  )
}

/**
 * Voice mode inside the shell. `createAdapter()` returns an adapter (see voiceSession.js); the component never knows the provider.
 * `onCard(card)` adds an agent-prepared card to the thread (it still needs Confirm there). `onExit()` returns to text.
 */
export default function VoiceMode ({ createAdapter, tenantKey, onCard, onExit }) {
  const [consented, setConsented] = useState(() => hasVoiceConsent(tenantKey))
  const [state, setState] = useState('connecting')
  const [lines, setLines] = useState([])
  const [muted, setMuted] = useState(false)
  const [provider, setProvider] = useState(null)
  const [error, setError] = useState('')
  const adapterRef = useRef(null)
  const endRef = useRef(null)
  const onCardRef = useRef(onCard)
  onCardRef.current = onCard

  useEffect(() => {
    if (!consented) return undefined
    let alive = true
    const adapter = createAdapter()
    adapterRef.current = adapter
    const offs = [
      adapter.on('state', (s) => { if (alive) setState(s) }),
      adapter.on('transcript', (m) => { if (alive) setLines((cur) => applyTranscript(cur, m)) }),
      adapter.on('card', (c) => { if (alive) onCardRef.current?.(c) }),
    ]
    adapter.connect().then(() => { if (alive) setProvider(adapter.provider) }).catch((e) => {
      if (!alive) return
      setError(e?.message || 'The voice service is not available.')
      setState('error')
    })
    return () => { alive = false; offs.forEach((off) => off()); adapter.disconnect(); adapterRef.current = null }
  }, [consented, createAdapter])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [lines])

  if (!consented) {
    return <Consent onAccept={() => { saveVoiceConsent(tenantKey); setConsented(true) }} onDecline={onExit} />
  }

  const toggleMute = () => { const next = !muted; setMuted(next); adapterRef.current?.setMuted(next) }
  const live = !['ended', 'error'].includes(state)

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-4 py-4" data-testid="voice-mode">
      <Orb state={state} />
      <p className="text-sm font-medium text-neutral-900" role="status" aria-live="polite" data-testid="voice-state">{muted && live ? 'Muted' : STATE_TEXT[state]}</p>
      {provider && <p className="text-xs text-neutral-600">Voice by {provider}</p>}
      {error && <p role="alert" className="max-w-xs text-center text-sm text-error-fg">{error} You can still type or use the microphone button in text mode.</p>}

      <div className="w-full max-w-md flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3" aria-live="polite" data-testid="voice-transcript">
        {lines.length === 0 ? (
          <p className="text-sm text-neutral-600">What you say and what the agent says will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={i} className={`text-sm ${l.role === 'user' ? 'text-right text-neutral-900' : 'text-left text-neutral-800'} ${l.final ? '' : 'opacity-60'}`}>
                <span className="mb-0.5 block text-xs text-neutral-600">{l.role === 'user' ? 'You' : 'Agent'}</span>
                {l.text}
              </li>
            ))}
            <li ref={endRef} aria-hidden="true" />
          </ul>
        )}
      </div>

      <div className="flex w-full max-w-md flex-wrap items-center gap-2">
        <button type="button" onClick={toggleMute} disabled={!live} aria-pressed={muted} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50">
          {muted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />} {muted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" onClick={() => { adapterRef.current?.disconnect(); setState('ended') }} disabled={!live} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-error-border bg-error-bg px-3 text-sm font-semibold text-error-fg hover:bg-white disabled:opacity-50">
          <Square className="h-4 w-4" aria-hidden="true" /> End
        </button>
        <button type="button" onClick={onExit} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> Switch to text
        </button>
      </div>
    </div>
  )
}
