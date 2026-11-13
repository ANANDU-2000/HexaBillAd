import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Plug, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

// Owner-only. Lets an AI tool (Claude, ChatGPT, Gemini or any MCP client) read THIS company's data through a secure token.
// The token is shown once. It only opens the MCP address, with the Owner's own access: lookups and drafts, never approvals.

const EXPIRY_OPTIONS = [
  { value: 365, label: '1 year' },
  { value: 90, label: '90 days' },
  { value: 30, label: '30 days' },
]

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const statusClass = (status) =>
  status === 'Active' ? 'bg-green-100 text-green-800' : status === 'Revoked' ? 'bg-neutral-200 text-neutral-700' : 'bg-warning-bg text-warning-fg'

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      toast.error('Copy is blocked in this browser. Select the text and copy it by hand.')
    }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
      {done ? <Check className="h-4 w-4 text-green-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  )
}

export default function McpConnectionsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState(365)
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState(null) // { token, name } - only held in memory, shown once
  const [client, setClient] = useState('claude-code')
  const [confirmId, setConfirmId] = useState(null)

  const mcpUrl = useMemo(() => `${window.location.origin}/api/mcp`, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/mcp-connections', { _bypassCache: true })
      setRows(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Connections could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (creating || name.trim().length < 2) return
    setCreating(true)
    try {
      const res = await api.post('/mcp-connections', { name: name.trim(), expiresInDays: days })
      const data = res.data?.data
      setFresh({ token: data.token, name: data.connection?.name || name.trim() })
      setName('')
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'The connection could not be created.')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id) => {
    try {
      await api.delete(`/mcp-connections/${id}`)
      toast.success('Connection revoked. It stops working immediately.')
      setConfirmId(null)
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'The connection could not be revoked.')
    }
  }

  const token = fresh?.token || '<your-token>'
  const snippets = {
    'claude-code': {
      label: 'Claude Code',
      text: `claude mcp add --transport http hexabill ${mcpUrl} --header "Authorization: Bearer ${token}"`,
    },
    gemini: {
      label: 'Gemini CLI',
      text: JSON.stringify({ mcpServers: { hexabill: { httpUrl: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
    },
    openai: {
      label: 'ChatGPT / OpenAI API',
      text: JSON.stringify({ type: 'mcp', server_label: 'hexabill', server_url: mcpUrl, authorization: token, require_approval: 'always' }, null, 2),
    },
    anthropic: {
      label: 'Claude API',
      text: JSON.stringify({ mcp_servers: [{ type: 'url', url: mcpUrl, name: 'hexabill', authorization_token: token }] }, null, 2),
    },
  }
  const snippet = snippets[client]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary-600" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">AI connections (MCP)</h2>
        </div>
        <p className="text-sm text-neutral-600">
          Let an AI tool such as Claude, ChatGPT or Gemini look up this company&apos;s customers, products and today&apos;s summary,
          and prepare drafts. It cannot approve or post anything: you confirm drafts in HexaBill. It sees only this company, with your access.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="mcp-url">Your company address</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="mcp-url" readOnly value={mcpUrl} onFocus={(e) => e.target.select()} className="min-h-[40px] min-w-[16rem] flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 font-mono text-sm" />
            <CopyButton text={mcpUrl} label="Copy address" />
          </div>
        </div>

        {/* Not a <form>: Settings wraps its tabs in one form, and a nested form would submit that one. */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="mcp-name">Connection name</label>
            <input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }} maxLength={80} placeholder="Claude on my laptop"
              className="min-h-[40px] w-full rounded-md border border-neutral-300 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="mcp-days">Valid for</label>
            <select id="mcp-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-h-[40px] rounded-md border border-neutral-300 px-3 text-sm">
              {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={create} disabled={creating || name.trim().length < 2}
            className="inline-flex min-h-[40px] items-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create connection'}
          </button>
        </div>

        {fresh && (
          <div className="mt-4 rounded-md border border-warning-border bg-warning-bg p-3" role="status">
            <p className="text-sm font-semibold text-warning-fg">Copy this token now for &ldquo;{fresh.name}&rdquo;. It will not be shown again.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input readOnly aria-label="New token" value={fresh.token} onFocus={(e) => e.target.select()} className="min-h-[40px] min-w-[16rem] flex-1 rounded-md border border-warning-border bg-white px-3 font-mono text-xs" />
              <CopyButton text={fresh.token} label="Copy token" />
              <button type="button" onClick={() => setFresh(null)} className="min-h-[40px] rounded-md border border-neutral-300 bg-white px-3 text-sm">Done</button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-neutral-700">Set up your AI tool</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="AI tool">
            {Object.entries(snippets).map(([id, s]) => (
              <button key={id} type="button" role="tab" aria-selected={client === id} onClick={() => setClient(id)}
                className={`min-h-[40px] rounded-md border px-3 text-sm ${client === id ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700' : 'border-neutral-300 bg-white text-neutral-700'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-neutral-800">{snippet.text}</pre>
            <div className="mt-2"><CopyButton text={snippet.text} label="Copy setup" /></div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            These are examples; check your tool&apos;s own MCP guide if the layout differs. Chat apps whose connector screen asks you to
            &ldquo;sign in&rdquo; (OAuth) cannot use these tokens yet.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-4 py-3 sm:px-6"><h3 className="text-base font-semibold text-neutral-900">Your connections</h3></div>
        {loading ? <p className="p-4 text-sm text-neutral-500">Loading…</p>
          : error ? <p className="p-4 text-sm text-error">{error} <button type="button" onClick={load} className="underline">Retry</button></p>
          : rows.length === 0 ? <p className="p-4 text-sm text-neutral-500">No connections yet.</p>
          : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Created</th>
                  <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Expires</th>
                  <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">Last used</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200">
                    <td className="px-4 py-2">
                      <span className="block font-medium text-neutral-900">{r.name}</span>
                      <span className="block font-mono text-xs text-neutral-500">{r.prefix}…</span>
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">{fmtDate(r.createdAt)}</td>
                    <td className="hidden px-3 py-2 md:table-cell">{fmtDate(r.expiresAt)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">{r.lastUsedAt ? fmtDate(r.lastUsedAt) : 'Never'}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(r.status)}`}>{r.status}</span></td>
                    <td className="px-4 py-2 text-right">
                      {r.status === 'Active' && (confirmId === r.id ? (
                        <span className="inline-flex gap-2">
                          <button type="button" onClick={() => revoke(r.id)} className="min-h-[40px] rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700">Confirm revoke</button>
                          <button type="button" onClick={() => setConfirmId(null)} className="min-h-[40px] rounded-md border border-neutral-300 px-3 text-sm">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmId(r.id)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm text-neutral-800 hover:bg-neutral-50">
                          <Trash2 className="h-4 w-4" aria-hidden /> Revoke
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
