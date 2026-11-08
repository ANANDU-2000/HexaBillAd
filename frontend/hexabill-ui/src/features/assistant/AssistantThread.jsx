import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, BarChart3, CreditCard, Package, Receipt, Sparkles, UserPlus, Wallet } from '../../components/ui/icons'
import { SUGGESTIONS, greetingFor } from './assistantUi'
import { SuggestionCard } from './ActionCards'
import { SummaryCard, ToolResultCard, asOfLabel } from './ToolResults'

export const ICON_BY_ID = { chart: BarChart3, alert: AlertCircle, package: Package, wallet: Wallet, receipt: Receipt, card: CreditCard, user: UserPlus }

const TOOL_STATUS_LABEL = { running: 'Checking', done: 'Checked', error: 'Could not check' }

export function AgentMark () {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white" aria-hidden="true">
      <Sparkles className="h-3 w-3" />
    </span>
  )
}

/** Three dots, still when the person prefers reduced motion. */
export function TypingDots ({ label = 'The agent is working' }) {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-live="polite" data-testid="typing-indicator">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-neutral-500 motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

function EmptyState ({ name, onSend }) {
  return (
    <div className="flex min-h-full flex-col justify-center px-1 py-6" data-testid="assistant-empty">
      <h3 className="text-lg font-semibold text-neutral-900">{greetingFor(name)}</h3>
      <p className="mt-0.5 text-sm text-neutral-700">What do you want to check or do?</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => {
          const Icon = ICON_BY_ID[s.icon]
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSend(s.prompt)}
              className="flex min-h-[88px] flex-col items-start gap-1 rounded-lg border border-neutral-200 bg-white p-3 text-left hover:border-neutral-300 hover:bg-neutral-50"
            >
              <Icon className="h-4 w-4 text-neutral-600" aria-hidden="true" />
              <span className="text-sm font-medium text-neutral-900">{s.title}</span>
              <span className="text-xs text-neutral-700">{s.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Sources ({ sources, asOf }) {
  if (!sources?.length && !asOf) return null
  return (
    <p className="mt-1 text-xs text-neutral-600">
      {sources?.length > 0 && (
        <>
          Sources:{' '}
          {sources.map((s, i) => (
            <span key={`${s.label}-${i}`}>
              {i > 0 && ', '}
              {s.href ? <Link to={s.href} className="text-primary-700 underline">{s.label}</Link> : s.label}
            </span>
          ))}
        </>
      )}
      {asOfLabel(asOf) && <span>{sources?.length > 0 ? ' · ' : ''}{asOfLabel(asOf)}</span>}
    </p>
  )
}

function AgentView ({ view, language, onSend }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      {view.kind === 'dashboard_summary' && <SummaryCard summary={view.summary} asOf={view.asOf} onAskPrompt={onSend} />}
      {view.kind === 'tool' && <ToolResultCard tool={view.tool} title={view.heading} rows={view.rows} asOf={view.asOf} />}
      {view.kind === 'suggestion' && (
        <>
          {view.heading && <p className="text-sm text-neutral-700">{view.heading}</p>}
          <SuggestionCard formKind={view.formKind} fields={view.fields} language={language} />
        </>
      )}
      {view.kind === 'reply' && view.heading && <p className="text-sm font-medium text-neutral-900">{view.heading}</p>}
      {view.text && <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-900">{view.text}</p>}
      {view.kind === 'reply' && view.grounded && <Sources sources={view.sources} asOf={view.asOf} />}
      {view.note && view.kind !== 'dashboard_summary' && view.kind !== 'suggestion' && <p className="text-xs text-neutral-600">{view.note}</p>}
    </div>
  )
}

function StreamingView ({ draft, language }) {
  const tools = draft?.tools || []
  return (
    <div className="min-w-0 flex-1 space-y-2">
      {tools.map((t) => (
        <p key={t.name} className="text-xs text-neutral-700">{TOOL_STATUS_LABEL[t.status] || 'Checking'} {t.name.replace(/_/g, ' ')}</p>
      ))}
      {draft?.text && <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-900">{draft.text}</p>}
      {(draft?.cards || []).map((card, i) => <SuggestionCard key={i} formKind={card.kind} fields={card.fields} language={language} />)}
      {!draft?.done && <TypingDots />}
    </div>
  )
}

export default function AssistantThread ({ messages, sending, userName, language, onSend }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages, sending])

  const streamingNow = messages.some((m) => m.streaming)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite" data-testid="assistant-thread">
      {messages.length === 0 ? (
        <EmptyState name={userName} onSend={onSend} />
      ) : (
        <div className="space-y-4">
          {messages.map((m) => {
            if (m.sender === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-100 px-3.5 py-2 text-sm text-neutral-900">{m.text}</div>
                </div>
              )
            }
            return (
              <div key={m.id} className="flex items-start gap-2">
                <AgentMark />
                {m.streaming ? <StreamingView draft={m.draft} language={language} /> : <AgentView view={m.view || { kind: 'unavailable', text: '' }} language={language} onSend={onSend} />}
              </div>
            )
          })}
          {sending && !streamingNow && (
            <div className="flex items-center gap-2"><AgentMark /><TypingDots /></div>
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
