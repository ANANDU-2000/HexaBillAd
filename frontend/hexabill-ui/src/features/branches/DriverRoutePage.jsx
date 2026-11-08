import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Navigation, Play, Square, MapPin, MapPinned, ChevronRight, RouteIcon, Undo2 } from '../../components/ui/icons'
import toast from 'react-hot-toast'
import { routesAPI } from '../../services/index'
import { localDateString } from '../../utils/dateFormat'
import { isAdminOrOwner } from '../../utils/roles'
import { useAuth } from '../../hooks/useAuth'
import { readApiErrorReason, saveOutcomeIsUncertain, uncertainSaveMessage } from '../../utils/apiError'
import { LoadingCard } from '../../components/Loading'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import BackLink from '../../components/ui/BackLink'
import Modal from '../../components/Modal'
import StopLocationMap, { requestDeviceGps } from '../../components/StopLocationMap'
import { gpsFailureMessage, isValidPoint } from '../../utils/shopLocation'
import { loadRoadLine } from '../routes/routeLine'
import { linePoints } from '../routes/routeMapState'
import LocationSharingPanel from './LocationSharingPanel'
import { NextStopCard, StopRow, ProblemSheet } from './DriverStops'
import useRouteTracker from './useRouteTracker'
import { TRACKER_EXPLANATION, trackerStatusText, distanceMeters } from './routeTracker'
import { newSessionId, shareBody } from './liveLocation'
import { applyOrder, nearestOrder, sameOrder, autoReorderOn } from './routeOrder'
import {
  mappableStops, locationNeededStops, runPhase, runSummaryParts, endRouteWarning, visitRequest, sendsProposedPin,
  nextStop, navigationWaypointsUrl, arrivalRequest, arrivalMessage, routeProgress, orderedStops,
} from './driverRoute'

const listOf = (res) => {
  const d = res?.data ?? res
  return Array.isArray(d) ? d : (d?.items ?? [])
}

const UNDO_MS = 10000

/** The routes this person is on (the server already limits the list to their assignments). */
export function DriverRoutesPage() {
  const [state, setState] = useState({ loading: true, error: false, routes: [] })
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const res = await routesAPI.getRoutes()
      setState({ loading: false, error: false, routes: listOf(res) })
    } catch {
      setState({ loading: false, error: true, routes: [] })
    }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-3">
      <h1 className="text-h2 font-semibold text-text-primary">My routes</h1>
      {state.loading && <LoadingCard />}
      {!state.loading && state.error && <ErrorState title="Your routes could not be loaded" message="Check your connection and try again." onAction={load} />}
      {!state.loading && !state.error && state.routes.length === 0 && (
        <EmptyState icon={RouteIcon} title="No routes assigned to you" description="Ask the office to assign you to a route." />
      )}
      {!state.loading && !state.error && state.routes.length > 0 && (
        <ul className="space-y-2" data-testid="my-routes-list">
          {state.routes.map((r) => (
            <li key={r.id}>
              <Link to={`/my-routes/${r.id}`} className="flex min-h-[56px] items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50">
                <span>
                  <span className="block font-medium text-text-primary">{r.name}</span>
                  {r.branchName && <span className="block text-sm text-neutral-600">{r.branchName}</span>}
                </span>
                <ChevronRight className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One route for the driver: start it, press Delivered at each stop, end it. With auto location on, the phone marks Arrived by itself near
 * the next stop's pin and keeps the screen awake. Location is asked once, after the driver reads why, and stops when the route ends.
 */
export default function DriverRoutePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canRecordPayment = isAdminOrOwner(user)
  const canSetPin = isAdminOrOwner(user) // only owners and admins may change a shop's saved location
  const routeId = Number(id)
  const date = useMemo(() => localDateString(), [])
  const [load, setLoad] = useState({ loading: true, error: false, notFound: false })
  const [route, setRoute] = useState(null)
  const [serverStops, setServerStops] = useState([])
  const [run, setRun] = useState({ current: null, last: null })
  const [busy, setBusy] = useState(false)
  const [problemFor, setProblemFor] = useState(null)
  const [endOpen, setEndOpen] = useState(false)
  const [endNote, setEndNote] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [trackOn, setTrackOn] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [localOrder, setLocalOrder] = useState(null)
  const [undo, setUndo] = useState(null)
  const [locationOn, setLocationOn] = useState(false)
  const [liveOn, setLiveOn] = useState(false)
  const [me, setMe] = useState(null)
  const [line, setLine] = useState({ path: null, source: 'straight' })
  const sessionRef = useRef(newSessionId())
  const undoTimer = useRef(null)

  const stops = useMemo(() => applyOrder(serverStops, localOrder), [serverStops, localOrder])

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoad({ loading: true, error: false, notFound: false })
    try {
      const [routeRes, stopsRes, runRes, flagRes, liveRes] = await Promise.all([
        routesAPI.getRoute(routeId),
        routesAPI.getStopsMap(routeId, date),
        routesAPI.getRun(routeId),
        routesAPI.getStopLocationFeatureFlag().catch(() => null),
        routesAPI.getLiveLocationFeatureFlag().catch(() => null),
      ])
      setRoute(routeRes?.data ?? routeRes)
      const fresh = orderedStops(stopsRes?.data ?? [])
      setServerStops(fresh)
      setRun(runRes?.data ?? { current: null, last: null })
      setLocationOn(!!(flagRes?.data?.enabled ?? flagRes?.enabled))
      setLiveOn(!!(liveRes?.data?.enabled ?? liveRes?.enabled))
      setLoad({ loading: false, error: false, notFound: false })
      return fresh
    } catch (e) {
      setLoad({ loading: false, error: true, notFound: e?.response?.status === 404 })
      return null
    }
  }, [routeId, date])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => () => clearTimeout(undoTimer.current), [])

  const phase = runPhase(run)
  const runsAvailable = run.available !== false
  // If the server cannot track runs yet, stops can still be recorded; there is just no Start or End.
  const running = phase === 'running' || !runsAvailable

  const natural = nextStop(stops)
  const current = (focusId != null && stops.find((s) => s.customerId === focusId && !['delivered', 'failed', 'skipped'].includes(s.mapStatus))) || natural

  const guarded = async (fn, failure) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(saveOutcomeIsUncertain(e) ? uncertainSaveMessage('stops') : readApiErrorReason(e, failure))
      await refresh(true)
    } finally {
      setBusy(false)
    }
  }

  // ---- live tracking (F02) -------------------------------------------------------------------------------------------------
  const sendPing = useCallback((f, first) => {
    if (!liveOn) return
    routesAPI.shareLocation(routeId, shareBody({ coords: { latitude: f.lat, longitude: f.lng, accuracy: f.accuracy }, sessionId: sessionRef.current, first })).catch(() => { /* the next ping will do */ })
  }, [liveOn, routeId])

  const autoArrive = (stop, fix) => {
    if (!stop || stop.mapStatus === 'arrived') return
    const request = arrivalRequest({ customerId: stop.customerId, date, fix, canSetPin, stopHasPin: isValidPoint(stop.mainLatitude, stop.mainLongitude), source: 'auto' })
    if (!request) return
    guarded(async () => {
      await routesAPI.updateCustomerVisit(routeId, stop.customerId, request.body)
      toast.success(`Arrived at ${stop.customerName}`)
      await refresh(true)
    }, 'That arrival could not be saved.')
  }

  const tracker = useRouteTracker({ enabled: trackOn && phase === 'running', next: natural, onArrive: autoArrive, onPing: sendPing })
  useEffect(() => { if (phase !== 'running' && trackOn) setTrackOn(false) }, [phase, trackOn])

  // ---- actions -----------------------------------------------------------------------------------------------------------
  const startRoute = (withLocation) => guarded(async () => {
    setStartOpen(false)
    const res = await routesAPI.startRun(routeId, date)
    setRun((r) => ({ ...r, current: res?.data ?? null }))
    setTrackOn(!!withLocation)
    await refresh(true)
    toast.success('Route started')
  }, 'The route could not be started.')

  const offerUndo = (prevIds) => {
    clearTimeout(undoTimer.current)
    setUndo({ prevIds })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }

  // After an outcome: put the nearest remaining pinned stop first. Shown with Undo for 10 s, never silent, and local to this trip.
  const reorderAfter = (fresh, from) => {
    if (!fresh || !autoReorderOn()) return
    const before = applyOrder(fresh, localOrder).map((s) => s.customerId)
    const origin = from && isValidPoint(from.mainLatitude, from.mainLongitude) ? { lat: Number(from.mainLatitude), lng: Number(from.mainLongitude) } : (tracker.fix || null)
    const after = nearestOrder(applyOrder(fresh, localOrder), origin)
    if (sameOrder(before, after)) return
    setLocalOrder(after)
    offerUndo(before)
  }

  const record = (stop, status, reason) => guarded(async () => {
    const stopHasPin = isValidPoint(stop.mainLatitude, stop.mainLongitude)
    const fix = trackOn && tracker.fix ? { ok: true, ...tracker.fix } : null
    const body = visitRequest({ customerId: stop.customerId, date, status, reason, fix, canSetPin, stopHasPin })
    await routesAPI.updateCustomerVisit(routeId, stop.customerId, body)
    setProblemFor(null)
    setFocusId(null)
    if (sendsProposedPin(body)) toast.success('Location saved for office review')
    const fresh = await refresh(true)
    reorderAfter(fresh, stop)
  }, 'That stop could not be saved.')

  // Manual fallback when auto location is off, denied or unavailable: one GPS reading, sent with the arrival.
  const arriveHere = (stop) => guarded(async () => {
    const fix = await requestDeviceGps()
    const stopHasPin = isValidPoint(stop.mainLatitude, stop.mainLongitude)
    const request = arrivalRequest({ customerId: stop.customerId, date, fix, canSetPin, stopHasPin, source: 'manual' })
    if (!request) { toast.error(gpsFailureMessage(fix?.reason)); return }
    await routesAPI.updateCustomerVisit(routeId, stop.customerId, request.body)
    setMe({ lat: fix.lat, lng: fix.lng })
    toast.success(arrivalMessage({ ...request, canSetPin, stopHasPin, accuracy: fix.accuracy }))
    await refresh(true)
  }, 'That arrival could not be saved.')

  const showMe = async () => {
    const fix = await requestDeviceGps()
    if (fix.ok) setMe({ lat: fix.lat, lng: fix.lng })
    else toast.error(gpsFailureMessage(fix.reason))
  }

  const endRoute = () => guarded(async () => {
    await routesAPI.endRun(routeId, endNote)
    if (liveOn && trackOn) routesAPI.stopSharingLocation(routeId).catch(() => {})
    setTrackOn(false)
    setEndOpen(false)
    setEndNote('')
    setLocalOrder(null)
    setUndo(null)
    await refresh(true)
    toast.success('Route ended')
  }, 'The route could not be ended.')

  const points = useMemo(() => linePoints(stops), [stops])
  const pointsKey = points.map((p) => `${p.lat},${p.lng}`).join(';')
  useEffect(() => {
    if (!locationOn || points.length < 2) { setLine({ path: null, source: 'straight' }); return undefined }
    let cancelled = false
    loadRoadLine(points).then((result) => { if (!cancelled) setLine(result) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, locationOn])

  if (load.loading) return <div className="mx-auto w-full max-w-2xl px-4 py-4"><LoadingCard /></div>
  if (load.error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <BackLink to="/my-routes" label="My routes" />
        <ErrorState
          title={load.notFound ? 'This route was not found' : 'The route could not be loaded'}
          message={load.notFound ? 'It may not be assigned to you.' : 'Check your connection and try again.'}
          onAction={load.notFound ? undefined : () => refresh()}
        />
      </div>
    )
  }

  const mappable = mappableStops(stops)
  const needLocation = locationOn ? locationNeededStops(stops) : []
  const summaryRun = run.current || run.last
  const nav = locationOn ? navigationWaypointsUrl(stops) : null
  const progress = routeProgress(stops)
  const autoActive = tracker.status === 'on' || tracker.status === 'starting'
  const meters = current && tracker.fix && isValidPoint(current.mainLatitude, current.mainLongitude)
    ? distanceMeters({ lat: tracker.fix.lat, lng: tracker.fix.lng }, { lat: Number(current.mainLatitude), lng: Number(current.mainLongitude) })
    : null
  const others = stops.filter((s) => s.customerId !== current?.customerId)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-3 space-y-3">
      <BackLink to="/my-routes" label="My routes" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-h2 font-semibold text-text-primary" data-testid="driver-route-title">{route?.name || 'Route'}</h1>
          <p className="text-sm font-medium text-neutral-700" data-testid="route-progress">{progress.text}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${running ? 'bg-success-bg text-success-fg' : phase === 'finished' ? 'bg-neutral-100 text-neutral-700' : 'bg-warning-bg text-warning-fg'}`}
          data-testid="run-phase"
        >
          {!runsAvailable ? 'Stops only' : running ? 'In progress' : phase === 'finished' ? 'Finished' : 'Not started'}
        </span>
      </div>

      {runsAvailable && phase !== 'running' && (
        <div className="space-y-2">
          {phase === 'finished' && <p className="text-sm text-neutral-700">This route was ended. You can start it again for another trip.</p>}
          <button
            type="button"
            disabled={busy || stops.length === 0}
            onClick={() => setStartOpen(true)}
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-lg font-semibold text-white disabled:opacity-60"
          >
            <Play className="h-5 w-5" aria-hidden="true" /> {phase === 'finished' ? 'Start route again' : 'Start route'}
          </button>
          {stops.length === 0 && <p className="text-sm text-neutral-600">This route has no stops yet.</p>}
        </div>
      )}
      {!canRecordPayment && (
        <p className="text-sm text-neutral-600" data-testid="payments-note">Cash and cheques you collect are recorded by the office in Payments.</p>
      )}

      {phase === 'running' && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-neutral-700" data-testid="tracker-status">
            {trackOn ? trackerStatusText(tracker.status) : (
              <button type="button" onClick={() => setTrackOn(true)} className="font-medium text-primary-700 underline" data-testid="enable-auto-location">Turn on auto location</button>
            )}
          </div>
          {runsAvailable && (
            <button type="button" disabled={busy} onClick={() => setEndOpen(true)} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-neutral-400 bg-white px-3 text-sm font-medium text-neutral-900 disabled:opacity-60">
              <Square className="h-4 w-4" aria-hidden="true" /> End route
            </button>
          )}
        </div>
      )}

      {undo && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800" role="status" data-testid="reorder-undo">
          <span>Order updated to save distance</span>
          <button type="button" onClick={() => { setLocalOrder(undo.prevIds); setUndo(null); clearTimeout(undoTimer.current) }} className="inline-flex min-h-[36px] items-center gap-1 font-medium text-primary-700 underline">
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
          </button>
        </div>
      )}

      {summaryRun && phase !== 'running' && (
        <div className="grid grid-cols-4 gap-2 text-center" data-testid="run-summary">
          {runSummaryParts(summaryRun).map((p) => (
            <div key={p.key} className="rounded-lg border border-neutral-200 bg-white px-1 py-2">
              <div className="text-lg font-semibold text-text-primary" data-testid={`summary-${p.key}`}>{p.value}</div>
              <div className="text-xs text-neutral-600">{p.label}</div>
            </div>
          ))}
        </div>
      )}

      {liveOn && phase === 'running' && !trackOn && <LocationSharingPanel routeId={routeId} routeRunning={phase === 'running'} />}

      {running && current && (
        <NextStopCard
          stop={current}
          busy={busy}
          canRecordPayment={canRecordPayment}
          meters={meters}
          showImHere={locationOn && !autoActive}
          onArrive={arriveHere}
          onDelivered={(s) => record(s, 'Delivered')}
          onProblem={setProblemFor}
        />
      )}

      {needLocation.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3" data-testid="location-needed">
          <p className="flex items-center gap-1 text-sm font-medium text-warning-fg"><MapPin className="h-4 w-4" aria-hidden="true" /> Location needed</p>
          <p className="mt-1 text-sm text-neutral-700">These stops have no shop location, so they are not on the map and have no directions. When you press Delivered there, your location goes to the office to confirm.</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-neutral-800">
            {needLocation.map((s) => <li key={s.customerId}>{s.position}. {s.customerName}</li>)}
          </ul>
        </div>
      )}

      <ul className="space-y-2" data-testid="stop-list">
        {(running ? others : stops).map((s) => <StopRow key={s.customerId} stop={s} onFocus={(st) => setFocusId(st.customerId)} />)}
      </ul>
      {stops.length === 0 && <EmptyState compact icon={RouteIcon} title="No stops on this route" description="Ask the office to add customers." />}

      {locationOn && mappable.length > 0 && (
        <div className="space-y-2">
          <StopLocationMap
            stops={mappable}
            numbered
            showPath
            height={260}
            linePath={line.path}
            linePathIsRoad={line.source === 'road'}
            selectedStopId={current?.customerId ?? null}
            fitKey={`${routeId}|${mappable.length}`}
            me={me}
          />
          {line.source === 'straight' && points.length > 1 && <p className="text-xs text-neutral-600">Straight-line route: road directions are not available right now.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={showMe} data-testid="show-me" className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm">
              <MapPinned className="h-4 w-4" aria-hidden="true" /> Show me on map
            </button>
            {nav && (
              <a href={nav.url} target="_blank" rel="noopener noreferrer" data-testid="navigate-remaining" className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm">
                <Navigation className="h-4 w-4" aria-hidden="true" /> Navigate remaining stops ({nav.count})
              </a>
            )}
          </div>
          {nav && (nav.dropped > 0 || nav.skippedNoPin > 0) && (
            <p className="text-xs text-neutral-600" data-testid="navigate-note">
              {nav.dropped > 0 && `Google Maps takes ${nav.count} stops at a time, so the last ${nav.dropped} are left out. `}
              {nav.skippedNoPin > 0 && `${nav.skippedNoPin} stop${nav.skippedNoPin === 1 ? ' has' : 's have'} no shop location and ${nav.skippedNoPin === 1 ? 'is' : 'are'} left out.`}
            </p>
          )}
        </div>
      )}

      {problemFor && <ProblemSheet stop={problemFor} busy={busy} onClose={() => setProblemFor(null)} onPick={(o) => o && record(problemFor, o.status, o.reason)} />}

      {startOpen && (
        <Modal isOpen title="Start this route?" onClose={() => !busy && setStartOpen(false)}>
          <div className="space-y-3" data-testid="start-route-dialog">
            <p className="text-sm text-neutral-800">{TRACKER_EXPLANATION}</p>
            <button type="button" disabled={busy} onClick={() => startRoute(true)} className="min-h-[52px] w-full rounded-md bg-primary-600 px-4 text-base font-semibold text-white disabled:opacity-60">Start with auto location</button>
            <button type="button" disabled={busy} onClick={() => startRoute(false)} className="min-h-[48px] w-full rounded-md border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-900 disabled:opacity-60">Start without location</button>
          </div>
        </Modal>
      )}

      {endOpen && (
        <Modal isOpen title="End this route?" onClose={() => !busy && setEndOpen(false)}>
          <div className="space-y-3" data-testid="end-route-dialog">
            <p className="text-sm text-neutral-800">{endRouteWarning(run.current)}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {runSummaryParts(run.current).map((p) => (
                <div key={p.key} className="rounded-lg border border-neutral-200 px-1 py-2">
                  <div className="text-lg font-semibold">{p.value}</div>
                  <div className="text-xs text-neutral-600">{p.label}</div>
                </div>
              ))}
            </div>
            <label className="block text-sm font-medium text-neutral-800" htmlFor="end-note">Note for the office (optional)</label>
            <textarea id="end-note" rows={2} maxLength={500} value={endNote} onChange={(e) => setEndNote(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm" disabled={busy} onClick={() => setEndOpen(false)}>Keep going</button>
              <button type="button" className="min-h-[44px] rounded-md bg-primary-600 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={busy} onClick={endRoute}>End route</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
