import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMapEvents } from 'react-leaflet'
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

const numberIcon = (number, color) => L.divIcon({
  className: '',
  html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:600 13px system-ui,sans-serif">${number}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
})

/**
 * Shared stop / pin map.
 * - stops: [{ customerId, customerName, mainLatitude, mainLongitude, mapStatus }]
 * - pickMode: click map to choose a pin
 * - selected: { lat, lng } preview pin
 * - numbered: show each stop as its visiting number (stops must carry `position`), coloured by status
 * - showPath: draw a straight line through the stops in order (not a road route)
 * - drivers: [{ id, name, lat, lng, stale }] live driver markers (grey when the last update is old)
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
    <div className="rounded-lg overflow-hidden border border-neutral-200" style={{ height }}>
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
        {numbered && showPath && markers.length > 1 && (
          <Polyline positions={markers.map((m) => [m.lat, m.lng])} pathOptions={{ color: '#64748b', weight: 3, dashArray: '6 6' }} />
        )}
        {numbered && markers.map((m, index) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={numberIcon(m.position || index + 1, STATUS_COLORS[m.status] || STATUS_COLORS.not_reached)}>
            <Popup>
              <div className="text-sm">
                <div className="font-medium">{m.position || index + 1}. {m.name}</div>
                <div className="text-neutral-500 capitalize">{(m.status || '').replace('_', ' ')}</div>
              </div>
            </Popup>
          </Marker>
        ))}
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
