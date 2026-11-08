import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, RefreshCw, ArrowUp, ArrowDown, X, Plus, Play, Save, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { superAdminAPI } from '../services/index'
import { LoadingCard } from '../components/Loading'

const apiMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

const SuperAdminAiPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)
  const [usage, setUsage] = useState(null)
  const [draft, setDraft] = useState(null) // editable copy of the runtime choices
  const [testing, setTesting] = useState({})
  const [testResult, setTestResult] = useState({})
  const [catalog, setCatalog] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogFor, setCatalogFor] = useState(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([superAdminAPI.getAiProviders(), superAdminAPI.getAiUsage().catch(() => null)])
      setData(p?.data || null)
      setUsage(u?.data || null)
      const rt = p?.data?.runtime || {}
      const providers = p?.data?.providers || []
      const models = {}
      providers.forEach((pr) => { models[pr.key] = (rt.models?.[pr.key] || pr.models || []).filter(Boolean) })
      setDraft({
        enabled: rt.enabled !== false,
        provider: rt.provider || providers.find((x) => x.isPrimary)?.key || '',
        fallbacks: rt.fallbacks || providers.filter((x) => x.isFallback).map((x) => x.key),
        allowPaidFallback: rt.allowPaidFallback ?? p?.data?.effective?.allowPaidFallback ?? false,
        dailyCalls: rt.dailyCalls ?? p?.data?.effective?.dailyCallLimit ?? 200,
        dailyTokens: rt.dailyTokens ?? p?.data?.effective?.dailyTokenLimit ?? 200000,
        models,
      })
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load AI settings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const realProviders = useMemo(() => (data?.providers || []).filter((p) => p.key !== 'mock'), [data])

  const move = (key, i, d) => setDraft((s) => {
    const list = [...(s.models[key] || [])]
    const j = i + d
    if (j < 0 || j >= list.length) return s
    ;[list[i], list[j]] = [list[j], list[i]]
    return { ...s, models: { ...s.models, [key]: list } }
  })
  const removeModel = (key, i) => setDraft((s) => ({ ...s, models: { ...s.models, [key]: (s.models[key] || []).filter((_, k) => k !== i) } }))
  const addModel = (key, id) => setDraft((s) => {
    const list = s.models[key] || []
    if (list.includes(id) || list.length >= 30) return s
    return { ...s, models: { ...s.models, [key]: [...list, id] } }
  })

  const test = async (key) => {
    setTesting((t) => ({ ...t, [key]: true }))
    try {
      const res = await superAdminAPI.testAiProvider(key)
      setTestResult((r) => ({ ...r, [key]: res?.data || { ok: false, failure: res?.message } }))
    } catch (err) {
      setTestResult((r) => ({ ...r, [key]: { ok: false, failure: apiMessage(err, 'Test failed') } }))
    } finally {
      setTesting((t) => ({ ...t, [key]: false }))
    }
  }

  const openCatalog = async (key) => {
    setCatalogFor(key)
    if (catalog) return
    setCatalogLoading(true)
    try {
      const res = await superAdminAPI.getOpenRouterModels(true)
      if (res?.success) setCatalog(res.data.models || [])
      else toast.error(res?.message || 'Could not load the OpenRouter list')
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load the OpenRouter list'))
    } finally {
      setCatalogLoading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const calls = Number(draft.dailyCalls)
      const tokens = Number(draft.dailyTokens)
      if (!Number.isFinite(calls) || calls < 1 || !Number.isFinite(tokens) || tokens < 1000) {
        toast.error('Daily calls must be at least 1 and daily tokens at least 1,000')
        return
      }
      await superAdminAPI.saveAiRuntime({
        enabled: draft.enabled,
        provider: draft.provider || null,
        fallbacks: draft.fallbacks,
        allowPaidFallback: draft.allowPaidFallback,
        dailyCalls: Math.round(calls),
        dailyTokens: Math.round(tokens),
        models: draft.models,
      })
      toast.success('AI settings saved. They apply within about 20 seconds.')
      await load()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('Go back to the server environment settings? Your model order and limits here will be cleared.')) return
    try {
      await superAdminAPI.resetAiRuntime()
      toast.success('Reset to the server environment')
      await load()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not reset'))
    }
  }

  if (loading) return <LoadingCard />
  if (!data || !draft) return <div className="p-6 text-sm text-neutral-600">AI settings are not available.</div>

  const filteredCatalog = (catalog || []).filter((m) => !filter || m.id.toLowerCase().includes(filter.toLowerCase()) || (m.name || '').toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">AI Control</h1>
            <p className="text-sm text-neutral-600">Models, order, daily limits and usage. API keys stay in the server environment.</p>
          </div>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={draft.enabled} disabled={!data.effective?.envEnabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            <span className="font-medium">Assistant on</span>
          </label>
          {!data.effective?.envEnabled && <span className="text-amber-700">Switched off in the server environment (Ai__Enabled). It cannot be turned on from here.</span>}
          <span className="text-neutral-600">Company data allowed by the server: <b>{data.customerDataAllowed ? 'yes (each owner must also approve)' : 'no'}</b></span>
          <span className="text-neutral-600">Order now: <b>{(data.effective?.chain || []).join(' → ') || 'none'}</b></span>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Provider order</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">First choice
            <select className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })}>
              {realProviders.map((p) => <option key={p.key} value={p.key}>{p.key}{p.paid ? ' (paid)' : ' (free)'}{p.configured ? '' : ' - no key'}</option>)}
            </select>
          </label>
          <div className="text-sm">If it fails, try (in order)
            <div className="mt-1 flex flex-wrap gap-2">
              {realProviders.filter((p) => p.key !== draft.provider).map((p) => {
                const on = draft.fallbacks.includes(p.key)
                return (
                  <button type="button" key={p.key} onClick={() => setDraft({ ...draft, fallbacks: on ? draft.fallbacks.filter((k) => k !== p.key) : [...draft.fallbacks, p.key] })}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-300 text-neutral-600'}`}>
                    {on ? `${draft.fallbacks.indexOf(p.key) + 1}. ` : '+ '}{p.key}{p.paid ? ' (paid)' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.allowPaidFallback} onChange={(e) => setDraft({ ...draft, allowPaidFallback: e.target.checked })} />
          Allow a paid model as a fallback when the free ones fail
        </label>
      </section>

      {realProviders.map((p) => (
        <section key={p.key} className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{p.key} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${p.paid ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{p.paid ? 'paid' : 'free'}</span></h2>
              <p className="text-xs text-neutral-500">{p.kind} · {p.configured ? 'key set' : 'NO KEY - set it in the server environment'}</p>
            </div>
            <div className="flex gap-2">
              {p.key.toLowerCase().includes('openrouter') && (
                <button type="button" onClick={() => openCatalog(p.key)} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"><Plus className="h-3.5 w-3.5" />Add from free list</button>
              )}
              <button type="button" disabled={!p.configured || testing[p.key]} onClick={() => test(p.key)} className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-2.5 py-1 text-xs text-white disabled:opacity-50"><Play className="h-3.5 w-3.5" />{testing[p.key] ? 'Testing…' : 'Test'}</button>
            </div>
          </div>
          {testResult[p.key] && (
            <p className={`mb-2 text-xs ${testResult[p.key].ok ? 'text-green-700' : 'text-red-700'}`}>
              {testResult[p.key].ok ? `Answered in ${testResult[p.key].latencyMs} ms by ${testResult[p.key].model}` : (testResult[p.key].failure || 'Failed')}
            </p>
          )}
          <ol className="space-y-1">
            {(draft.models[p.key] || []).map((m, i) => (
              <li key={m} className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-sm">
                <span className="w-5 text-xs text-neutral-400">{i + 1}</span>
                <span className="flex-1 break-all">{m}</span>
                <button type="button" aria-label="Move up" onClick={() => move(p.key, i, -1)} className="p-1 hover:bg-neutral-100"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Move down" onClick={() => move(p.key, i, 1)} className="p-1 hover:bg-neutral-100"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Remove" onClick={() => removeModel(p.key, i)} className="p-1 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
            {(draft.models[p.key] || []).length === 0 && <li className="text-xs text-neutral-500">No models. The server environment model is used.</li>}
          </ol>
          {catalogFor === p.key && (
            <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-neutral-400" />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter free models" className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
                <button type="button" onClick={() => setCatalogFor(null)} className="text-xs text-neutral-500">Close</button>
              </div>
              {catalogLoading ? <p className="text-xs text-neutral-500">Loading the current free models…</p> : (
                <ul className="max-h-60 space-y-1 overflow-auto">
                  {filteredCatalog.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="break-all">{m.id}<span className="ml-2 text-xs text-neutral-400">{m.contextLength ? `${Math.round(m.contextLength / 1000)}k` : ''}</span></span>
                      <button type="button" disabled={(draft.models[p.key] || []).includes(m.id)} onClick={() => addModel(p.key, m.id)} className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-40">Add</button>
                    </li>
                  ))}
                  {filteredCatalog.length === 0 && <li className="text-xs text-neutral-500">Nothing matches.</li>}
                </ul>
              )}
              <p className="mt-2 text-xs text-amber-700">Free models may keep and learn from what is sent to them. A free model that is busy is skipped for a few minutes, then tried again.</p>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Daily limit per company</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Calls per day
            <input type="number" min="1" className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" value={draft.dailyCalls} onChange={(e) => setDraft({ ...draft, dailyCalls: e.target.value })} />
          </label>
          <label className="text-sm">Tokens per day
            <input type="number" min="1000" step="1000" className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" value={draft.dailyTokens} onChange={(e) => setDraft({ ...draft, dailyTokens: e.target.value })} />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"><RotateCcw className="h-4 w-4" />Reset to server settings</button>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Usage (last 7 days, counts only)</h2>
        {!usage || usage.perTenant.length === 0 ? <p className="text-sm text-neutral-500">No AI use yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs text-neutral-500"><th className="py-1 pr-3">Company</th><th className="pr-3">Calls today</th><th className="pr-3">Tokens today</th><th className="pr-3">Calls 7d</th><th>Tokens 7d</th></tr></thead>
              <tbody>
                {usage.perTenant.map((t) => (
                  <tr key={t.tenantId} className="border-b last:border-0">
                    <td className="py-1 pr-3">{t.name}</td><td className="pr-3">{t.todayCalls}</td><td className="pr-3">{t.todayTokens.toLocaleString()}</td><td className="pr-3">{t.weekCalls}</td><td>{t.weekTokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default SuperAdminAiPage
