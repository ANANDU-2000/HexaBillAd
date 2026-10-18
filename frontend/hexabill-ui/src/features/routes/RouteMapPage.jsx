import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import StopLocationMap, { requestDeviceGps } from '../../components/StopLocationMap'
import SearchableSelect from '../../components/ui/SearchableSelect'
import Alert from '../../components/ui/Alert'
import { routesAPI } from '../../services'
import { useAuth } from '../../hooks/useAuth'
import { gpsFailureMessage } from '../../utils/shopLocation'
import { describeDrivers, POLL_INTERVAL_MS } from '../branches/liveLocation'
import { applyView, linePoints, readFocusParams, summarize, SHOW_FILTERS, SORTS } from './routeMapState'
import { loadRoadLine } from './routeLine'
import StopCard from './StopCard'
import StopDetail from './StopDetail'
import MapBottomSheet from './MapBottomSheet'

const unwrap = (res) => res?.data ?? res
const selectClass = 'block h-10 w-full border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30'

function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true))
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return matches
}

function Totals({ totals }) {
  const cells = [
    ['Stops', `${totals.visited}/${totals.stops}`],
    ['Owed', totals.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    ['Overdue', totals.overdueCustomers ? totals.overdue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'None'],
  ]
  return (
    <dl className="grid grid-cols-3 gap-2" data-testid="route-map-totals">
      {cells.map(([label, value]) => (
        <div key={label} className="min-w-0 border border-neutral-200 bg-white px-2 py-1">
          <dt className="text-micro uppercase tracking-wide text-neutral-500">{label}</dt>
          <dd className="truncate text-sm font-semibold tabular-nums text-neutral-900">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function RouteMapPage() {
  const { user } = useAuth()
  const role = (user?.role || '').toLowerCase()
  const showCreditLimit = role === 'owner' || role === 'admin' || role === 'systemadmin'
  const desktop = useIsDesktop()
  const [searchParams, setSearchParams] = useSearchParams()
  const focus = useMemo(() => readFocusParams(searchParams.toString()), [searchParams])

  const [routes, setRoutes] = useState([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [routesError, setRoutesError] = useState('')
  const [routeId, setRouteId] = useState(focus.routeId)
  const [stops, setStops] = useState([])
  const [stopsLoading, setStopsLoading] = useState(false)
  const [stopsError, setStopsError] = useState('')
  const [pinsOn, setPinsOn] = useState(true)
  const [liveOn, setLiveOn] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('route_order')
  const [origin, setOrigin] = useState(null)
  const [originNote, setOriginNote] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [panNonce, setPanNonce] = useState(0)
  const [sheet, setSheet] = useState('peek')
  const [line, setLine] = useState({ path: null, source: 'straight' })
  const [pinBusy, setPinBusy] = useState(false)
  const [dismissedFixes, setDismissedFixes] = useState(() => new Set())
  const cardRefs = useRef({})
  const focusApplied = useRef(false)

  // Routes the caller may see.
  useEffect(() => {
    let cancelled = false
    routesAPI.getMapOverview()
      .then((res) => {
        if (cancelled) return
        const list = unwrap(res)?.routes ?? []
        setRoutes(list)
        setRouteId((current) => (current && list.some((r) => r.routeId === current) ? current : list[0]?.routeId ?? null))
      })
      .catch((err) => { if (!cancelled) setRoutesError(err?.response?.data?.message || 'Could not load your routes.') })
      .finally(() => { if (!cancelled) setRoutesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    routesAPI.getStopLocationFeatureFlag().then((res) => setPinsOn(!!(res?.data?.enabled ?? res?.enabled))).catch(() => setPinsOn(false))
    routesAPI.getLiveLocationFeatureFlag().then((res) => setLiveOn(!!(res?.data?.enabled ?? res?.enabled))).catch(() => setLiveOn(false))
  }, [])

  // Stops of the chosen route, refreshed while the page is visible.
  const loadStops = useCallback(async (silent) => {
    if (!routeId) return
    if (!silent) setStopsLoading(true)
    try {
      const res = await routesAPI.getMapStops(routeId)
      setStops(unwrap(res) ?? [])
      setStopsError('')
      setUpdatedAt(Date.now())
    } catch (err) {
      if (!silent) setStopsError(err?.response?.data?.message || 'Could not load the stops for this route.')
    } finally {
      if (!silent) setStopsLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    setStops([]); setSelectedId(null); setDrivers([]); setLine({ path: null, source: 'straight' })
    loadStops(false)
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') loadStops(true) }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadStops])

  // Live drivers for this route.
  useEffect(() => {
    if (!liveOn || !routeId) return undefined
    let cancelled = false
    const poll = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await routesAPI.getLiveLocations(routeId)
        if (!cancelled) setDrivers(describeDrivers(unwrap(res) ?? []))
      } catch {
        if (!cancelled) setDrivers([])
      }
    }
    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [liveOn, routeId])

  // Road line through the pins in route order; straight dashed line when the service cannot answer.
  const points = useMemo(() => linePoints(stops), [stops])
  const pointsKey = points.map((p) => `${p.lat},${p.lng}`).join(';')
  useEffect(() => {
    if (points.length < 2) { setLine({ path: null, source: 'straight' }); return undefined }
    let cancelled = false
    loadRoadLine(points).then((result) => { if (!cancelled) setLine(result) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  const select = useCallback((customerId) => {
    setSelectedId(customerId)
    setPanNonce((n) => n + 1)
    if (!desktop) setSheet('peek')
  }, [desktop])

  // "Show on map" from the assistant: ?route=&focus=
  useEffect(() => {
    if (focusApplied.current || !focus.customerId || !stops.length) return
    if (stops.some((s) => s.customerId === focus.customerId)) {
      focusApplied.current = true
      select(focus.customerId)
    }
  }, [focus.customerId, stops, select])

  useEffect(() => {
    if (selectedId && desktop) cardRefs.current[selectedId]?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedId, desktop])

  const changeSort = async (value) => {
    setSort(value)
    if (value !== 'nearest' || origin) return
    const result = await requestDeviceGps()
    if (result.ok) { setOrigin({ lat: result.lat, lng: result.lng }); setOriginNote('') }
    else {
      setOriginNote(gpsFailureMessage(result.reason))
      setSort('route_order')
      toast('Showing route order instead.')
    }
  }

  const confirmPin = async (stop, fix) => {
    if (pinBusy) return
    setPinBusy(true)
    try {
      await routesAPI.confirmPinFromVisit(routeId, stop.customerId, fix.visitId, fix.replaces)
      toast.success('Shop location saved.')
      await loadStops(true)
      setPanNonce((n) => n + 1)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'The shop location could not be saved.')
      await loadStops(true)
    } finally {
      setPinBusy(false)
    }
  }
  const dismissFix = (stop, fix) => setDismissedFixes((prev) => new Set(prev).add(fix.visitId))

  const changeRoute = (value) => {
    const next = Number(value)
    setRouteId(next || null)
    focusApplied.current = true
    if (searchParams.get('route') || searchParams.get('focus')) setSearchParams({}, { replace: true })
  }

  const visible = useMemo(() => applyView(stops, { search, filter, sort, origin }), [stops, search, filter, sort, origin])
  const totals = useMemo(() => summarize(stops), [stops])
  const selected = useMemo(() => {
    const found = stops.find((s) => s.customerId === selectedId) || null
    // A fix the person chose "Not now" for stays hidden until the page is reloaded.
    return found?.pendingFix && dismissedFixes.has(found.pendingFix.visitId) ? { ...found, pendingFix: null } : found
  }, [stops, selectedId, dismissedFixes])
  const canManage = routes.find((r) => r.routeId === routeId)?.canManage === true
  const mapStops = useMemo(() => visible, [visible])
  const fitKey = `${routeId}|${filter}|${search}|${stops.length}`
  const onlineDrivers = drivers.filter((d) => !d.stale).length

  const routeOptions = routes.map((r) => ({ value: String(r.routeId), label: r.name, meta: r.branchName || '', hint: r.overdueCustomers ? `${r.overdueCustomers} overdue` : '' }))

  const searchBox = (
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          type="search"
          aria-label="Search customers"
          placeholder="Search name, area or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block h-10 w-full border border-neutral-300 bg-white pl-8 pr-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
        {search && (
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')} data-size="sm" className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-neutral-500 hover:text-neutral-900">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
  )

  const routeSelect = routes.length > 1 ? (
    <SearchableSelect
      aria-label="Route"
      value={routeId ? String(routeId) : ''}
      onChange={(e) => changeRoute(e.target.value)}
      options={routeOptions}
      searchPlaceholder="Search routes..."
    />
  ) : null

  const filters = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0 text-xs font-medium text-neutral-600">
          Show me
          <select aria-label="Show me" className={`${selectClass} mt-0.5`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            {SHOW_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="block min-w-0 text-xs font-medium text-neutral-600">
          Sort by
          <select aria-label="Sort by" className={`${selectClass} mt-0.5`} value={sort} onChange={(e) => changeSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {originNote && <Alert tone="info" onDismiss={() => setOriginNote('')}>{originNote}</Alert>}
    </div>
  )

  const list = (
    <div data-testid="route-map-list">
      {stopsLoading && <p className="px-3 py-6 text-sm text-neutral-600">Loading stops…</p>}
      {!stopsLoading && stopsError && <div className="p-3"><Alert tone="error" action={<button type="button" onClick={() => loadStops(false)} className="min-h-[36px] border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">Try again</button>}>{stopsError}</Alert></div>}
      {!stopsLoading && !stopsError && stops.length === 0 && <p className="px-3 py-6 text-sm text-neutral-600">This route has no customers yet.</p>}
      {!stopsLoading && !stopsError && stops.length > 0 && visible.length === 0 && <p className="px-3 py-6 text-sm text-neutral-600">No stops match. Clear the search or choose “All stops”.</p>}
      {visible.map((stop) => (
        <div key={stop.customerId} ref={(el) => { cardRefs.current[stop.customerId] = el }}>
          <StopCard stop={stop} selected={stop.customerId === selectedId} onSelect={select} />
        </div>
      ))}
    </div>
  )

  const notices = (
    <>
      {!pinsOn && <Alert tone="info">Customer map pins are switched off for this company. The list and amounts still work.</Alert>}
      {pinsOn && totals.noPin > 0 && stops.length > 0 && <Alert tone="warning">{totals.noPin} of {totals.stops} stops have no saved location, so they are missing from the map.</Alert>}
    </>
  )

  const map = (
    <StopLocationMap
      bare
      muted
      numbered
      showPath
      height="100%"
      stops={mapStops}
      linePath={line.path}
      linePathIsRoad={line.source === 'road'}
      selectedStopId={selectedId}
      onStopClick={select}
      fitKey={fitKey}
      panNonce={panNonce}
      resizeKey={`${desktop}|${sheet}`}
      me={origin}
      drivers={drivers.map((d) => ({ id: d.userId, name: d.userName, lat: Number(d.latitude), lng: Number(d.longitude), stale: d.stale }))}
    />
  )

  if (routesLoading) return <p className="p-4 text-sm text-neutral-600" data-testid="route-map-page">Loading routes…</p>
  if (routesError) return <div className="p-4" data-testid="route-map-page"><Alert tone="error">{routesError}</Alert></div>
  if (!routes.length) {
    return (
      <div className="p-4" data-testid="route-map-page">
        <Alert tone="info" title="No routes yet">Routes you can see will appear here with their customers on a map.</Alert>
      </div>
    )
  }

  const liveText = liveOn ? (onlineDrivers ? `${onlineDrivers} driver${onlineDrivers === 1 ? '' : 's'} live` : 'No driver live') : null
  const freshness = updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''

  if (desktop) {
    return (
      <div data-testid="route-map-page" className="flex min-h-0 flex-1 overflow-hidden border border-neutral-300 bg-white">
        <aside className="flex w-[360px] shrink-0 flex-col border-r border-neutral-300">
          <div className="space-y-2 border-b border-neutral-200 p-3">
            <h1 className="text-base font-semibold text-neutral-900">Route map</h1>
            {routeSelect}
            {searchBox}
            {filters}
            <Totals totals={totals} />
            <p className="text-xs text-neutral-500">{[liveText, freshness].filter(Boolean).join(' · ')}</p>
            {notices}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </aside>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0 isolate z-0">{map}</div>
          {selected && (
            <div className="absolute right-3 top-3 z-10 w-[320px] max-w-[calc(100%-24px)]">
              <StopDetail stop={selected} onClose={() => setSelectedId(null)} showCreditLimit={showCreditLimit} canManage={canManage} onConfirmPin={confirmPin} onDismissFix={dismissFix} busy={pinBusy} />
            </div>
          )}
          {line.source === 'straight' && points.length > 1 && (
            <p className="absolute bottom-3 left-3 z-10 border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600">Straight-line route (road directions unavailable)</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="route-map-page" className="relative min-h-0 flex-1 overflow-hidden border border-neutral-300 bg-white">
      <div className="absolute inset-0 isolate z-0">{map}</div>
      {selected && (
        <div className="absolute inset-x-2 z-10" style={{ bottom: sheet === 'peek' ? 'calc(196px + 8px)' : undefined, top: sheet === 'peek' ? undefined : 8 }}>
          <StopDetail stop={selected} onClose={() => setSelectedId(null)} showCreditLimit={showCreditLimit} canManage={canManage} onConfirmPin={confirmPin} onDismissFix={dismissFix} busy={pinBusy} />
        </div>
      )}
      <MapBottomSheet
        state={sheet}
        onStateChange={setSheet}
        header={
          <div className="space-y-2">
            {searchBox}
            <Totals totals={totals} />
          </div>
        }
      >
        {sheet !== 'peek' && (
          <>
            <div className="space-y-2 border-b border-neutral-200 p-3">
              {routeSelect}
              {filters}
              {notices}
            </div>
            {list}
          </>
        )}
      </MapBottomSheet>
    </div>
  )
}
