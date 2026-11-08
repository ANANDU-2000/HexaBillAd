import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AssistantBody from './AssistantBody'
import AssistantShell from './AssistantShell'
import { assistantStore, useAssistantStore } from './assistantStore'
import { readOpen, shellModeFor, writeOpen } from './assistantUi'

export const ASSISTANT_PATH = '/assistant'

export function useViewportWidth () {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export const tenantKeyFor = (user) => String(user?.tenantId ?? user?.id ?? 'none')

/**
 * The floating assistant: right drawer (>=1024, pushes content), bottom sheet (700-1023), full screen (<700).
 * Layout owns `open`/`onClose` (header button). Ctrl+J and openAssistant() work without Layout through assistantStore.
 */
export default function AssistantPanel ({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const store = useAssistantStore()
  const width = useViewportWidth()
  const mode = shellModeFor(width)
  const tenantKey = tenantKeyFor(user)
  const [language, setLanguage] = useState('en')
  const [agentState, setAgentState] = useState('idle')
  const onFullPage = location.pathname === ASSISTANT_PATH
  const visible = (open || store.openRequested) && !onFullPage

  useEffect(() => { assistantStore.bindTenant(tenantKey) }, [tenantKey])

  // Restore the drawer if it was open last time for this tenant (desktop only: a full-screen phone sheet should not reopen by itself).
  useEffect(() => {
    if (shellModeFor(window.innerWidth) === 'drawer' && readOpen(tenantKey)) assistantStore.requestOpen()
  }, [tenantKey])

  useEffect(() => { if (mode === 'drawer') writeOpen(tenantKey, visible) }, [visible, mode, tenantKey])
  useEffect(() => { assistantStore.setPanelOpen(visible) }, [visible])

  const close = useCallback(() => { assistantStore.clearOpenRequest(); onClose?.() }, [onClose])
  useEffect(() => { if (store.closeNonce > 0) close() }, [store.closeNonce, close])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        if (visible) close(); else assistantStore.requestOpen()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, close])

  if (!visible) return null

  return (
    <AssistantShell
      mode={mode}
      state={agentState}
      language={language}
      onLanguage={setLanguage}
      onClose={close}
      onToggleExpand={() => { close(); navigate(ASSISTANT_PATH, { state: { from: `${location.pathname}${location.search}` } }) }}
    >
      <AssistantBody mode={mode} language={language} user={user} onAgentState={setAgentState} />
    </AssistantShell>
  )
}
