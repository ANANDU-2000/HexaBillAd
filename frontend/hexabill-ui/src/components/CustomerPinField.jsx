import { useState } from 'react'
import { MapPin, LocateFixed, Map as MapIcon, ExternalLink } from 'lucide-react'
import Modal from './Modal'
import StopLocationMap, { requestDeviceGps } from './StopLocationMap'
import {
  isValidPoint, gpsFailureMessage, accuracyAdvice, describeShopLocation, navigationUrl,
} from '../utils/shopLocation'

const same = (a, b) => a && b && Number(a.lat).toFixed(6) === Number(b.lat).toFixed(6) && Number(a.lng).toFixed(6) === Number(b.lng).toFixed(6)

/**
 * Customer shop location without coordinates on screen.
 * - lat/lng: current form value (may be a new choice); saved: the pin already stored on the server, if any.
 * - onChange({lat,lng}) sets a new pin; onClear() drops an unsaved choice; onRemoveSaved(true|false) marks the saved pin for removal.
 */
export default function CustomerPinField({ lat, lng, saved = null, updatedAt = null, updatedByMe = false, clearing = false, onChange, onClear, onRemoveSaved }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [advice, setAdvice] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [picked, setPicked] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const current = isValidPoint(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : null
  const hasSaved = !!saved
  const pending = !!current && !clearing && !same(current, saved)
  const shown = clearing ? null : current
  const navHref = shown ? navigationUrl(shown.lat, shown.lng) : null

  const useMyLocation = async () => {
    setBusy(true)
    setProblem('')
    setAdvice('')
    const result = await requestDeviceGps()
    setBusy(false)
    if (!result.ok) {
      setProblem(gpsFailureMessage(result.reason))
      return
    }
    setAdvice(accuracyAdvice(result.accuracy) || '')
    onRemoveSaved?.(false)
    onChange({ lat: result.lat, lng: result.lng })
  }

  const openMap = () => {
    setProblem('')
    setPicked(shown)
    setMapOpen(true)
  }

  const confirmPick = () => {
    if (!picked) return
    setAdvice('')
    onRemoveSaved?.(false)
    onChange(picked)
    setMapOpen(false)
  }

  return (
    <div className="md:col-span-2 space-y-3 border border-neutral-200 rounded-lg p-3 bg-neutral-50" data-testid="customer-pin-field">
      <div>
        <p className="text-sm font-medium text-neutral-800 flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden="true" /> Shop location (optional)
        </p>
        <p className="text-sm text-neutral-600 mt-1" role="status" data-testid="pin-status">
          {describeShopLocation({ hasPin: hasSaved || (!!shown && !pending), updatedAt, updatedByMe, pending, clearing })}
        </p>
      </div>

      {shown && (
        <div data-testid="pin-preview">
          <StopLocationMap selected={shown} center={[shown.lat, shown.lng]} height={150} />
        </div>
      )}

      {problem && <p className="text-sm text-error-fg" role="alert" data-testid="pin-problem">{problem}</p>}
      {advice && <p className="text-sm text-warning-fg" role="status" data-testid="pin-advice">{advice}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Finding your location…' : "I'm at this shop — use my location"}
        </button>
        <button
          type="button"
          onClick={openMap}
          className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" /> Choose on map
        </button>
        {!hasSaved && current && (
          <button type="button" onClick={() => { setProblem(''); setAdvice(''); onClear() }} className="min-h-[44px] px-3 py-2 text-sm text-neutral-700 underline">
            Set later
          </button>
        )}
        {hasSaved && !clearing && !confirmRemove && (
          <button type="button" onClick={() => setConfirmRemove(true)} className="min-h-[44px] px-3 py-2 text-sm text-neutral-700 underline">
            Remove saved location
          </button>
        )}
        {hasSaved && clearing && (
          <button type="button" onClick={() => onRemoveSaved?.(false)} className="min-h-[44px] px-3 py-2 text-sm text-neutral-700 underline">
            Keep saved location
          </button>
        )}
        {navHref && (
          <a href={navHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 text-sm text-primary-700 underline">
            Open in maps <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      {confirmRemove && (
        <div className="rounded-sm border border-neutral-200 border-l-4 border-l-warning bg-white p-3 text-sm" role="alertdialog" aria-label="Remove saved location" data-testid="pin-remove-confirm">
          <p className="text-neutral-800">Remove this customer's saved shop location? Drivers will no longer see this stop on the map.</p>
          <div className="flex gap-2 mt-2">
            <button type="button" className="min-h-[44px] px-3 py-2 border rounded-md bg-white" onClick={() => setConfirmRemove(false)}>Keep it</button>
            <button type="button" className="min-h-[44px] px-3 py-2 rounded-md bg-error text-white" onClick={() => { setConfirmRemove(false); onClear(); onRemoveSaved?.(true) }}>
              Yes, remove it
            </button>
          </div>
        </div>
      )}

      {mapOpen && (
        <Modal isOpen title="Choose the shop on the map" onClose={() => setMapOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">Tap the map where the shop is. Zoom in to be exact.</p>
            <StopLocationMap
              pickMode
              selected={picked}
              onPick={setPicked}
              stops={saved ? [{ customerId: 'saved', customerName: 'Saved location', mainLatitude: saved.lat, mainLongitude: saved.lng, mapStatus: 'not_reached' }] : []}
              center={picked ? [picked.lat, picked.lng] : null}
              height={320}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="min-h-[44px] px-3 py-2 border rounded-lg" onClick={() => setMapOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={!picked}
                className="min-h-[44px] px-3 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                onClick={confirmPick}
              >
                {hasSaved && picked && !same(picked, saved) ? 'Replace saved location' : 'Use this location'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
