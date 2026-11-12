import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, SlidersHorizontal } from '../../components/ui/icons'
import { assistantApi } from './assistantApi'
import { assistantStore } from './assistantStore'
import { agentState } from './assistantUi'
import AssistantComposer from './AssistantComposer'
import AssistantThread from './AssistantThread'
import VoiceMode from './VoiceMode'
import { loadLivekit } from './livekitLoader'
import { DEMO_VOICE_STEPS, createLivekitAdapter, createMockVoiceAdapter, voiceTransportKind } from './voiceSession'
import { useAssistantChat } from './useAssistantChat'

const CARD_KINDS = new Set(['new_payment', 'new_sale', 'new_expense', 'new_customer'])

function Policy ({ consentInfo, onSave }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-neutral-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-9 w-full items-center justify-between px-4 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
        <span className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> AI privacy</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      {open && (
        <div className="max-h-48 space-y-2 overflow-y-auto border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-neutral-900">Company AI consent</span>
            {consentInfo?.canManage && (
              <button type="button" onClick={() => onSave(!consentInfo?.enabled)} className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-900 hover:bg-neutral-100">
                {consentInfo?.enabled ? 'Turn AI off' : 'Turn AI on'}
              </button>
            )}
          </div>
          <p className="leading-normal text-neutral-700">
            {consentInfo?.policyNotice || 'AI questions are limited to your own company. The agent can look things up and prepare drafts; nothing is saved until a person confirms it.'}
          </p>
        </div>
      )}
    </div>
  )
}

/** Thread + composer (+ voice mode) used by the drawer, the sheet, the phone screen and the /assistant page. */
export default function AssistantBody ({ mode, language, user, active = true, onAgentState }) {
  const { messages, sending, send, store } = useAssistantChat()
  const [consentInfo, setConsentInfo] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const tenantKey = user?.tenantId ?? user?.id ?? 'none'
  const kind = voiceTransportKind()
  const voiceAvailable = kind === 'livekit' || kind === 'mock'

  useEffect(() => {
    if (!active) return undefined
    let alive = true
    assistantApi.consent().then((res) => { if (alive && res.ok) setConsentInfo(res.data) })
    return () => { alive = false }
  }, [active])

  useEffect(() => { if (active && !assistantStore.getState().activeId) assistantStore.newThread() }, [active, store.tenantKey])

  const lastView = [...messages].reverse().find((m) => m.sender === 'assistant')?.view
  const hadError = lastView?.kind === 'unavailable' || lastView?.kind === 'refused'
  const state = agentState({ sending, error: hadError && !sending })
  useEffect(() => { onAgentState?.(voiceOpen ? 'idle' : state) }, [state, voiceOpen, onAgentState])

  const createAdapter = useCallback(() => {
    if (kind === 'mock') return createMockVoiceAdapter({ steps: DEMO_VOICE_STEPS, provider: 'mock-voice' })
    return createLivekitAdapter({
      fetchSession: assistantApi.voiceSession,
      loadLivekit: () => loadLivekit().catch(() => { throw new Error('The voice service is not available.') }),
    })
  }, [kind])

  const onCard = useCallback((card) => {
    if (!card || !CARD_KINDS.has(card.kind)) return
    const id = assistantStore.getState().activeId || assistantStore.newThread()
    assistantStore.addMessage(id, { sender: 'assistant', view: { kind: 'suggestion', formKind: card.kind, fields: card.fields || {}, heading: 'Prepared by voice. Check it before you confirm.', rows: [], text: null, note: null } })
  }, [])

  const saveConsent = useCallback(async (enabled) => {
    const res = await assistantApi.setConsent(enabled, consentInfo?.policyFingerprint)
    if (res.ok) { setConsentInfo(res.data); toast.success(enabled ? 'AI turned on for this company.' : 'AI turned off.') } else toast.error(res.message || 'Could not update the AI setting.')
  }, [consentInfo])

  const onPrefillUsed = useCallback(() => assistantStore.consumePrefill(), [])
  const voiceStable = useMemo(() => createAdapter, [createAdapter])

  return (
    <>
      {voiceOpen ? (
        <VoiceMode createAdapter={voiceStable} tenantKey={tenantKey} onCard={onCard} onExit={() => setVoiceOpen(false)} />
      ) : (
        <>
          <AssistantThread messages={messages} sending={sending} userName={user?.name} language={language} onSend={send} />
          <AssistantComposer
            onSend={send}
            sending={sending}
            language={language}
            showChips={messages.length > 0}
            prefill={store.prefill}
            onPrefillUsed={onPrefillUsed}
            onOpenVoice={voiceAvailable ? () => setVoiceOpen(true) : undefined}
          />
        </>
      )}
      <Policy consentInfo={consentInfo} onSave={saveConsent} />
      <span hidden data-mode={mode} />
    </>
  )
}
