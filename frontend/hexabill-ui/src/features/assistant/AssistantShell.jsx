import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Sparkles, X } from '../../components/ui/icons'
import { DRAWER_WIDTH, STATE_LABEL } from './assistantUi'
import { VOICE_LANGUAGES } from './voice'

const DOT = {
  idle: 'bg-neutral-400',
  thinking: 'bg-primary-600 motion-safe:animate-pulse',
  listening: 'bg-primary-600 motion-safe:animate-pulse',
  speaking: 'bg-primary-600',
  error: 'bg-error',
}

/** Header + frame. mode: drawer (>=1024, pushes content) | sheet (700-1023, bottom sheet) | phone (<700, full screen) | page (/assistant). */
export default function AssistantShell ({ mode, state = 'idle', language, onLanguage, onClose, onToggleExpand, expanded = false, children }) {
  const closeRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const dragStart = useRef(null)
  const floating = mode !== 'page'

  useEffect(() => {
    if (!floating) return undefined
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [floating, onClose])

  // The drawer pushes the page content instead of covering it (rule lives in index.css, desktop widths only).
  useEffect(() => {
    if (mode !== 'drawer') return undefined
    document.documentElement.style.setProperty('--assistant-dock', `${DRAWER_WIDTH}px`)
    document.body.classList.add('assistant-docked')
    return () => { document.body.classList.remove('assistant-docked'); document.documentElement.style.removeProperty('--assistant-dock') }
  }, [mode])

  const onHandleDown = (e) => { dragStart.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId) }
  const onHandleMove = (e) => { if (dragStart.current != null) setDragY(Math.max(0, e.clientY - dragStart.current)) }
  const onHandleUp = () => {
    const moved = dragY
    dragStart.current = null
    setDragY(0)
    if (moved > 100) onClose?.()
  }

  const frame = {
    drawer: `fixed inset-y-0 right-0 z-[70] flex flex-col border-l border-neutral-200 bg-white`,
    sheet: 'fixed inset-x-0 bottom-0 z-[70] flex h-[90dvh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white shadow-xl',
    phone: 'fixed inset-0 z-[70] flex flex-col bg-white',
    page: 'flex h-full min-h-0 flex-1 flex-col bg-white',
  }[mode]

  return (
    <>
      {mode === 'sheet' && <div className="fixed inset-0 z-[69] bg-neutral-900/30" onClick={onClose} aria-hidden="true" data-testid="assistant-backdrop" />}
      <aside
        role={floating ? 'dialog' : 'region'}
        aria-label="HexaBill Agent"
        aria-modal={mode === 'sheet' || mode === 'phone' ? 'true' : undefined}
        data-shell-hides-nav={floating && mode !== 'drawer' ? '' : undefined}
        data-mode={mode}
        data-state={state}
        className={frame}
        style={mode === 'drawer' ? { width: DRAWER_WIDTH } : (mode === 'sheet' && dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined)}
      >
        {mode === 'sheet' && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            data-testid="sheet-handle"
          >
            <span className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
          </div>
        )}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white" aria-hidden="true"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold leading-tight text-neutral-900">HexaBill Agent</h2>
              <p className="flex items-center gap-1.5 text-xs text-neutral-700" data-testid="agent-state">
                <span className={`h-2 w-2 rounded-full ${DOT[state] || DOT.idle}`} aria-hidden="true" />
                {STATE_LABEL[state] || STATE_LABEL.idle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => onLanguage?.(e.target.value)}
              className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {VOICE_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.id.toUpperCase()}</option>)}
            </select>
            {onToggleExpand && (
              <button type="button" onClick={onToggleExpand} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100" aria-label={expanded ? 'Back to side panel' : 'Expand to full view'}>
                {expanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {floating && (
              <button ref={closeRef} type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100" aria-label="Close assistant">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>
        {children}
      </aside>
    </>
  )
}
