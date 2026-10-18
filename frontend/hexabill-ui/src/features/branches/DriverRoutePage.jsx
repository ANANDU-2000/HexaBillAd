import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Navigation, Play, Square, MapPin, MapPinned, LocateFixed, Wallet, ChevronRight, Route as RouteIcon } from 'lucide-react'
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
import {
  statusLabel, needsReason, reasonIsValid, orderedStops, mappableStops, locationNeededStops, stopNavigationUrl,
  runPhase, runSummaryParts, endRouteWarning, visitRequest, MIN_REASON_LENGTH,
  nextStop, navigationWaypointsUrl, arrivalRequest, arrivalMessage,
} from './driverRoute'

const STATUS_STYLES = {
  not_reached: 'bg-neutral-100 text-neutral-700',
  arrived: 'bg-info-bg text-info-fg',
  delivered: 'bg-success-bg text-success-fg',
  failed: 'bg-error-bg text-error-fg',
  skipped: 'bg-warning-bg text-warning-fg',
}

const listOf = (res) => {
  const d = res?.data ?? res
  return Array.isArray(d) ? d : (d?.items ?? [])
}

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

function StopCard({ stop, running, busy, onAction, reasonFor, setReasonFor, canRecordPayment, locationOn, isNext, onArrive }) {
  const [reason, setReason] = useState('')
  const navUrl = stopNavigationUrl(stop)
  const asking = reasonFor && reasonFor.customerId === stop.customerId ? reasonFor.status : null
  const done = stop.mapStatus === 'delivered'

  return (
    <li className={`rounded-lg border bg-white p-3 space-y-2 ${isNext ? 'border-info ring-2 ring-info/30' : 'border-neutral-200'}`} data-testid={`stop-${stop.customerId}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white" aria-label={`Stop ${stop.position}`}>
          {stop.position}
        </span>
        <div className="min-w-0 flex-1">
          {isNext && <p className="text-xs font-semibold uppercase tracking-wide text-info-fg">Next stop</p>}
          <p className="font-medium text-text-primary break-words">{stop.customerName}</p>
          {stop.address && <p className="text-sm text-neutral-600 break-words">{stop.address}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[stop.mapStatus] || STATUS_STYLES.not_reached}`} data-testid={`stop-status-${stop.customerId}`}>
          {statusLabel(stop.mapStatus)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {navUrl && (
          <a href={navUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm">
            <Navigation className="h-4 w-4" aria-hidden="true" /> Open in maps
          </a>
        )}
        {canRecordPayment && (
          <Link to={`/payments?customerId=${stop.customerId}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm">
            <Wallet className="h-4 w-4" aria-hidden="true" /> Record payment
          </Link>
        )}
      </div>

      {running && !done && !asking && locationOn && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onArrive(stop)}
          data-testid={`im-here-${stop.customerId}`}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-info bg-white px-3 text-sm font-medium text-info-fg disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" /> I'm here
        </button>
      )}

      {running && !done && !asking && (
        <div className="grid grid-cols-2 gap-2">
          {[['Arrived', 'Arrived'], ['Delivered', 'Delivered'], ['Failed', 'Failed'], ['Skipped', 'Skipped']].map(([status, label]) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => (needsReason(status) ? (setReason(''), setReasonFor({ customerId: stop.customerId, status })) : onAction(stop, status))}
              className={`min-h-[44px] rounded-md border px-3 text-sm font-medium disabled:opacity-60 ${status === 'Delivered' ? 'border-success bg-success text-white' : 'border-neutral-300 bg-white text-neutral-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {running && asking && (
        <div className="space-y-2" data-testid={`reason-box-${stop.customerId}`}>
          <label className="block text-sm font-medium text-neutral-800" htmlFor={`reason-${stop.customerId}`}>
            Why was this stop {asking.toLowerCase()}?
          </label>
          <textarea
            id={`reason-${stop.customerId}`}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="For example: shop closed, no one to receive"
          />
          {!reasonIsValid(reason) && <p className="text-xs text-neutral-600">At least {MIN_REASON_LENGTH} characters.</p>}
          <div className="flex gap-2">
            <button type="button" className="min-h-[44px] rounded-md border border-neutral-300 px-3 text-sm" onClick={() => setReasonFor(null)}>Cancel</button>
            <button
              type="button"
              disabled={busy || !reasonIsValid(reason)}
              className="min-h-[44px] rounded-md bg-primary-600 px-3 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => onAction(stop, asking, reason)}
            >
              Save {asking.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** One route for the driver: start it, work the stops in order, end it. A location is read only when the person presses "I'm here" or "Show me on map". */
export default function DriverRoutePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canRecordPayment = isAdminOrOwner(user)
  const canSetPin = isAdminOrOwner(user) // only owners and admins may change a shop's saved location
  const routeId = Number(id)
  const date = useMemo(() => localDateString(), [])
  const [load, setLoad] = useState({ loading: true, error: false, notFound: false })
  const [route, setRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [run, setRun] = useState({ current: null, last: null })
  const [busy, setBusy] = useState(false)
  const [reasonFor, setReasonFor] = useState(null)
  const [endOpen, setEndOpen] = useState(false)
  const [endNote, setEndNote] = useState('')
  const [locationOn, setLocationOn] = useState(false)
  const [liveOn, setLiveOn] = useState(false)
  const [me, setMe] = useState(null)
  const [line, setLine] = useState({ path: null, source: 'straight' })

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
      setStops(orderedStops(stopsRes?.data ?? []))
      setRun(runRes?.data ?? { current: null, last: null })
      setLocationOn(!!(flagRes?.data?.enabled ?? flagRes?.enabled))
      setLiveOn(!!(liveRes?.data?.enabled ?? liveRes?.enabled))
      setLoad({ loading: false, error: false, notFound: false })
    } catch (e) {
      setLoad({ loading: false, error: true, notFound: e?.response?.status === 404 })
    }
  }, [routeId, date])
  useEffect(() => { refresh() }, [refresh])

  const phase = runPhase(run)
  const runsAvailable = run.available !== false
  // If the server cannot track runs yet, stops can still be recorded; there is just no Start or End.
  const running = phase === 'running' || !runsAvailable

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

  const startRoute = () => guarded(async () => {
    const res = await routesAPI.startRun(routeId, date)
    setRun((r) => ({ ...r, current: res?.data ?? null }))
    await refresh(true)
    toast.success('Route started')
  }, 'The route could not be started.')

  const recordStop = (stop, status, reason) => guarded(async () => {
    await routesAPI.updateCustomerVisit(routeId, stop.customerId, visitRequest({ customerId: stop.customerId, date, status, reason }))
    setReasonFor(null)
    await refresh(true)
  }, 'That stop could not be saved.')

  // "I'm here": one GPS reading, sent with the arrival. Nothing is sent if the phone cannot give a position.
  const arriveHere = (stop) => guarded(async () => {
    const fix = await requestDeviceGps()
    const stopHasPin = isValidPoint(stop.mainLatitude, stop.mainLongitude)
    const request = arrivalRequest({ customerId: stop.customerId, date, fix, canSetPin, stopHasPin })
    if (!request) { toast.error(gpsFailureMessage(fix?.reason)); return }
    await routesAPI.updateCustomerVisit(routeId, stop.customerId, request.body)
    setMe({ lat: fix.lat, lng: fix.lng })
    setReasonFor(null)
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
    setEndOpen(false)
    setEndNote('')
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
  const next = nextStop(stops)
  const nav = locationOn ? navigationWaypointsUrl(stops) : null

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-4">
      <BackLink to="/my-routes" label="My routes" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h2 font-semibold text-text-primary" data-testid="driver-route-title">{route?.name || 'Route'}</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${running ? 'bg-success-bg text-success-fg' : phase === 'finished' ? 'bg-neutral-100 text-neutral-700' : 'bg-warning-bg text-warning-fg'}`}
          data-testid="run-phase"
        >
          {!runsAvailable ? 'Stops only' : running ? 'In progress' : phase === 'finished' ? 'Finished' : 'Not started'}
        </span>
      </div>

      {!canRecordPayment && (
        <p className="text-sm text-neutral-600" data-testid="payments-note">Cash and cheques you collect are recorded by the office in Payments.</p>
      )}

      {runsAvailable && phase !== 'running' && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
          {phase === 'finished' && <p className="text-sm text-neutral-700">This route was ended. You can start it again for another trip.</p>}
          {phase === 'notStarted' && <p className="text-sm text-neutral-700">Start the route when you leave. You can then mark each stop as you go.</p>}
          <button
            type="button"
            disabled={busy || stops.length === 0}
            onClick={startRoute}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-base font-medium text-white disabled:opacity-60"
          >
            <Play className="h-5 w-5" aria-hidden="true" /> {phase === 'finished' ? 'Start route again' : 'Start route'}
          </button>
          {stops.length === 0 && <p className="text-sm text-neutral-600">This route has no stops yet.</p>}
        </div>
      )}

      {summaryRun && (
        <div className="grid grid-cols-4 gap-2 text-center" data-testid="run-summary">
          {runSummaryParts(summaryRun).map((p) => (
            <div key={p.key} className="rounded-lg border border-neutral-200 bg-white px-1 py-2">
              <div className="text-lg font-semibold text-text-primary" data-testid={`summary-${p.key}`}>{p.value}</div>
              <div className="text-xs text-neutral-600">{p.label}</div>
            </div>
          ))}
        </div>
      )}

      {liveOn && phase === 'running' && <LocationSharingPanel routeId={routeId} routeRunning={phase === 'running'} />}

      {running && next && (
        <div className="rounded-sm border border-neutral-200 border-l-4 border-l-info bg-white p-3" data-testid="next-stop">
          <p className="text-xs font-semibold uppercase tracking-wide text-info-fg">Next stop</p>
          <p className="mt-0.5 font-medium text-text-primary break-words">{next.position}. {next.customerName}</p>
          {next.address && <p className="text-sm text-neutral-600 break-words">{next.address}</p>}
          {stopNavigationUrl(next) && (
            <a href={stopNavigationUrl(next)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[44px] items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm">
              <Navigation className="h-4 w-4" aria-hidden="true" /> Navigate to next stop
            </a>
          )}
        </div>
      )}

      {locationOn && mappable.length > 0 && (
        <div className="space-y-2">
          <StopLocationMap
            stops={mappable}
            numbered
            showPath
            height={260}
            linePath={line.path}
            linePathIsRoad={line.source === 'road'}
            selectedStopId={next?.customerId ?? null}
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

      {locationOn && running && (
        <p className="text-xs text-neutral-600" data-testid="im-here-note">
          “I'm here” reads your phone's location once and sends it with the arrival. Nothing is read until you press it.
        </p>
      )}

      {needLocation.length > 0 && (
        <div className="rounded-sm border border-neutral-200 border-l-4 border-l-warning bg-white p-3" data-testid="location-needed">
          <p className="flex items-center gap-1 text-sm font-medium text-warning-fg"><MapPin className="h-4 w-4" aria-hidden="true" /> Location needed</p>
          <p className="mt-1 text-sm text-neutral-700">These stops have no shop location, so they are not on the map and have no directions. Press “I'm here” when you arrive: your location goes to the office to confirm.</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-neutral-800">
            {needLocation.map((s) => <li key={s.customerId}>{s.position}. {s.customerName}</li>)}
          </ul>
        </div>
      )}

      <ul className="space-y-3" data-testid="stop-list">
        {stops.map((s) => (
          <StopCard
            key={s.customerId}
            stop={s}
            running={running}
            busy={busy}
            onAction={recordStop}
            reasonFor={reasonFor}
            setReasonFor={setReasonFor}
            canRecordPayment={canRecordPayment}
            locationOn={locationOn}
            isNext={next?.customerId === s.customerId}
            onArrive={arriveHere}
          />
        ))}
      </ul>
      {stops.length === 0 && <EmptyState compact icon={RouteIcon} title="No stops on this route" description="Ask the office to add customers." />}

      {runsAvailable && phase === 'running' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setEndOpen(true)}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-neutral-400 bg-white px-4 text-base font-medium text-neutral-900 disabled:opacity-60"
        >
          <Square className="h-5 w-5" aria-hidden="true" /> End route
        </button>
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
