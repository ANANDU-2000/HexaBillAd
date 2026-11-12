import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AssistantBody from './AssistantBody'
import AssistantShell from './AssistantShell'
import { assistantStore, useAssistantStore } from './assistantStore'
import { tenantKeyFor } from './AssistantPanel'

/** /assistant: full view. History list on the left (this session only), the thread centred at max 760 px. */
export default function AssistantPage () {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const store = useAssistantStore()
  const [language, setLanguage] = useState('en')
  const [agentState, setAgentState] = useState('idle')
  const tenantKey = tenantKeyFor(user)

  useEffect(() => { assistantStore.bindTenant(tenantKey) }, [tenantKey])

  const minimize = () => {
    assistantStore.requestOpen()
    navigate(typeof location.state?.from === 'string' ? location.state.from : '/dashboard')
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[420px] overflow-hidden rounded-lg border border-neutral-200 bg-white" data-testid="assistant-page">
      <nav aria-label="Conversations" className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 md:flex">
        <div className="border-b border-neutral-200 p-3">
          <button type="button" onClick={() => assistantStore.newThread()} className="min-h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100">New chat</button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {store.threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => assistantStore.selectThread(t.id)}
                aria-current={t.id === store.activeId ? 'true' : undefined}
                className={`w-full truncate rounded-md px-3 py-2 text-left text-sm ${t.id === store.activeId ? 'bg-white font-medium text-neutral-900 ring-1 ring-neutral-200' : 'text-neutral-700 hover:bg-neutral-100'}`}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-neutral-200 p-3 text-xs text-neutral-600">Chats are kept only while this page is open.</p>
      </nav>
      <div className="flex min-w-0 flex-1 justify-center">
        <div className="flex w-full max-w-[760px] min-w-0 flex-col">
          <AssistantShell mode="page" state={agentState} language={language} onLanguage={setLanguage} onToggleExpand={minimize} expanded>
            <AssistantBody mode="page" language={language} user={user} onAgentState={setAgentState} />
          </AssistantShell>
        </div>
      </div>
    </div>
  )
}
