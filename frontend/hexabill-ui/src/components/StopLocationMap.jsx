import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { gpsFailureReason } from '../utils/shopLocation'

// Vite: fix default marker icon paths
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const UAE_CENTER = [24.4539, 54.3773]

function MapClickHandler({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled || !onPick) return
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/** Fits the view to the pins whenever `fitKey` changes (new route, new filter), not on every poll. */
function FitToPins({ points, fitKey }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(points, { padding: [48, 48], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map])
  return null
}

/** Moves the view to one point (a selected stop) without changing the zoom more than needed. */
function PanTo({ point, nonce }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo(point, Math.max(map.getZoom(), 15), { duration: 0.4 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, map])
  return null
}

/** Keeps the map sized when its container changes (sheet height, side panel). */
function ResizeWatcher({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(id)
  }, [trigger, map])
  return null
}

const STATUS_COLORS = {
  reached: '#059669',
  delivered: '#059669',
  arrived: '#2563eb',
  failed: '#dc2626',
  not_reached: '#64748b',
  skipped: '#d97706',
}

const driverIcon = (stale) => L.divIcon({
  className: '',
  html: `<div style="background:${stale ? '#94a3b8' : '#1d4ed8'};color:#fff;width:30px;height:30px;border-radius:6px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font:700 12px system-ui,sans-serif">DR</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
})

const numberIcon = (number, color, active = false) => {
  const size = active ? 36 : 28
  const ring = active ? 'box-shadow:0 0 0 3px #111827,0 2px 6px rgba(0,0,0,.5)' : 'box-shadow:0 1px 4px rgba(0,0,0,.45)'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;${ring};display:flex;align-items:center;justify-content:center;font:600 ${active ? 15 : 13}px system-ui,sans-serif">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

const meIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/**
 * Shared stop / pin map.
 * - stops: [{ customerId, customerName, mainLatitude, mainLongitude, mapStatus }]
 * - pickMode: click map to choose a pin
 * - selected: { lat, lng } preview pin
 * - numbered: show each stop as its visiting number (stops must carry `position`), coloured by status
 * - showPath: draw a straight line through the stops in order (not a road route)
 * - drivers: [{ id, name, lat, lng, stale }] live driver markers (grey when the last update is old)
 * Route Map extras (all optional, the other screens ignore them):
 * - linePath: [[lat, lng], ...] road line drawn instead of the straight dashed one; linePathIsRoad solid vs dashed
 * - selectedStopId / onStopClick(stop): highlight one stop and report taps (popups are off when onStopClick is set)
 * - fitKey: re-fit the view to the pins when it changes; panNonce: pan to the selected stop when it changes
 * - bare: no border/radius (the page frames the map); muted: greyscale tiles; resizeKey: re-measure the map when its container changes; me: {lat, lng} device position
 */
export default function StopLocationMap({
  stops = [],
  height = 320,
  pickMode = false,
  selected = null,
  onPick = null,
  center = null,
  numbered = false,
  showPath = false,
  drivers = [],
  linePath = null,
  linePathIsRoad = false,
  selectedStopId = null,
  onStopClick = null,
  fitKey = null,
  panNonce = 0,
  muted = false,
  bare = false,
  resizeKey = null,
  me = null,
}) {
  const [mapCenter, setMapCenter] = useState(center || UAE_CENTER)

  const markers = useMemo(() => {
    return (stops || [])
      .filter((s) => s.mainLatitude != null && s.mainLongitude != null)
      .map((s) => ({
        id: s.customerId,
        position: s.position,
        name: s.customerName,
        lat: Number(s.mainLatitude),
        lng: Number(s.mainLongitude),
        status: s.mapStatus || 'not_reached',
      }))
  }, [stops])

  const selectedMarker = useMemo(() => markers.find((m) => m.id === selectedStopId) || null, [markers, selectedStopId])

  useEffect(() => {
    if (center) {
      setMapCenter(center)
      return
    }
    if (selected?.lat != null && selected?.lng != null) {
      setMapCenter([selected.lat, selected.lng])
      return
    }
    if (markers.length > 0) {
      setMapCenter([markers[0].lat, markers[0].lng])
    }
  }, [center, selected, markers])

  return (
    <div className={`${bare ? '' : 'rounded-lg border border-neutral-200'} overflow-hidden ${muted ? 'hb-map-muted' : ''}`} style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={markers.length || selected ? 13 : 10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler enabled={pickMode} onPick={onPick} />
        {fitKey != null && <FitToPins points={markers.map((m) => [m.lat, m.lng])} fitKey={fitKey} />}
        {panNonce > 0 && selectedMarker && <PanTo point={[selectedMarker.lat, selectedMarker.lng]} nonce={panNonce} />}
        {resizeKey != null && <ResizeWatcher trigger={resizeKey} />}
        {numbered && showPath && linePath && linePath.length > 1 && (
          <Polyline positions={linePath} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85, dashArray: linePathIsRoad ? null : '6 6' }} />
        )}
        {numbered && showPath && !linePath && markers.length > 1 && (
          <Polyline positions={markers.map((m) => [m.lat, m.lng])} pathOptions={{ color: '#64748b', weight: 3, dashArray: '6 6' }} />
        )}
        {numbered && markers.map((m, index) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={numberIcon(m.position || index + 1, STATUS_COLORS[m.status] || STATUS_COLORS.not_reached, m.id === selectedStopId)}
            zIndexOffset={m.id === selectedStopId ? 800 : 0}
            eventHandlers={onStopClick ? { click: () => onStopClick(m.id) } : undefined}
          >
            {!onStopClick && (
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">{m.position || index + 1}. {m.name}</div>
                  <div className="text-neutral-500 capitalize">{(m.status || '').replace('_', ' ')}</div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
        {me && Number.isFinite(me.lat) && Number.isFinite(me.lng) && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
        {!numbered && markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={9}
            pathOptions={{
              color: STATUS_COLORS[m.status] || STATUS_COLORS.not_reached,
              fillColor: STATUS_COLORS[m.status] || STATUS_COLORS.not_reached,
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium">{m.name}</div>
                <div className="text-neutral-500 capitalize">{(m.status || '').replace('_', ' ')}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {(drivers || []).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)).map((d) => (
          <Marker key={`driver-${d.id}`} position={[d.lat, d.lng]} icon={driverIcon(d.stale)} zIndexOffset={1000}>
            <Popup>
              <div className="text-sm">
                <div className="font-medium">{d.name}</div>
                <div className="text-neutral-500">{d.stale ? 'Last update is not recent' : 'Live position'}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {selected?.lat != null && selected?.lng != null && (
          <Marker position={[selected.lat, selected.lng]}>
            <Popup>Selected pin</Popup>
          </Marker>
        )}
      </MapContainer>
      {pickMode && (
        <p className="text-xs text-neutral-500 px-2 py-1 bg-neutral-50 border-t border-neutral-200">
          Tap the map to drop a pin (GPS fallback when permission is denied).
        </p>
      )}
    </div>
  )
}

/**
 * Ask the device for its position once. Resolves to { ok: true, lat, lng, accuracy } or { ok: false, reason }
 * where reason is denied | timeout | unavailable | unsupported (see utils/shopLocation.js for the wording).
 */
export function requestDeviceGps(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, reason: 'unsupported' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => resolve({ ok: false, reason: gpsFailureReason(err) }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

/** Capture device GPS; returns { lat, lng } or null. */
export async function captureDeviceGps(timeoutMs = 12000) {
  const result = await requestDeviceGps(timeoutMs)
  return result.ok ? { lat: result.lat, lng: result.lng } : null
}
