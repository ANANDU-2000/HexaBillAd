import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
  not_reached: '#64748b',
  skipped: '#d97706',
}

/**
 * Shared stop / pin map.
 * - stops: [{ customerId, customerName, mainLatitude, mainLongitude, mapStatus }]
 * - pickMode: click map to choose a pin
 * - selected: { lat, lng } preview pin
 */
export default function StopLocationMap({
  stops = [],
  height = 320,
  pickMode = false,
  selected = null,
  onPick = null,
  center = null,
}) {
  const [mapCenter, setMapCenter] = useState(center || UAE_CENTER)

  const markers = useMemo(() => {
    return (stops || [])
      .filter((s) => s.mainLatitude != null && s.mainLongitude != null)
      .map((s) => ({
        id: s.customerId,
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
        {markers.map((m) => (
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

/** Capture device GPS; returns { lat, lng } or null. */
export function captureDeviceGps(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}
