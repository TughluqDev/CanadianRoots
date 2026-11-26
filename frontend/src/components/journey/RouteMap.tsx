import L from 'leaflet'
import { WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { hours } from '@/lib/utils'
import type { Travel, TripStop } from '@/types/api'

function pin(label: string, origin = false) {
  return L.divIcon({
    className: origin ? 'journey-map-marker bg-terracotta-700' : 'journey-map-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
    html: label,
  })
}

export default function RouteMap({ stops, travel }: { stops: TripStop[]; travel: Travel }) {
  const [tilesFailed, setTilesFailed] = useState(false)
  const points = useMemo(() => {
    const pts: [number, number][] = stops.map((s) => [s.experience.latitude, s.experience.longitude])
    if (travel.effective_method === 'car') pts.push([travel.origin.latitude, travel.origin.longitude])
    if (pts.length === 1) {
      const [lat, lng] = pts[0]
      pts.push([lat + 0.4, lng + 0.6], [lat - 0.4, lng - 0.6])
    }
    return pts
  }, [stops, travel])
  const bounds = useMemo(() => L.latLngBounds(points).pad(0.25), [points])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cream-300">
      <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-80 w-full sm:h-96" aria-label="Map of journey stops">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <Marker position={[travel.origin.latitude, travel.origin.longitude]} icon={pin('★', true)}>
          <Popup><strong>Start: {travel.origin.city}, {travel.origin.province}</strong></Popup>
        </Marker>
        {stops.map((s, i) => (
          <Marker key={s.id} position={[s.experience.latitude, s.experience.longitude]} icon={pin(String(i + 1))}>
            <Popup>
              <div className="min-w-48">
                <p className="text-xs font-semibold text-terracotta">Day {s.day_number} · Stop {i + 1}</p>
                <p className="mt-0.5 text-base font-semibold text-forest-900">{s.experience.name}</p>
                <p className="text-xs text-ink-soft">{s.experience.city}, {s.experience.province}</p>
                <p className="mt-1.5 text-xs text-ink-soft">Visit ≈ {hours(s.experience.visit_duration_hours)}</p>
                {s.experience.food_spotlight_name && <p className="mt-1 text-xs">🍽 {s.experience.food_spotlight_name}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && (
        <div className="absolute inset-x-4 bottom-4 z-[500] flex items-center gap-2 rounded-xl bg-cream-50/95 px-4 py-3 text-sm text-ink-soft">
          <WifiOff className="size-4 text-terracotta" aria-hidden />
          The map background needs an internet connection. Stop markers are still available.
        </div>
      )}
    </div>
  )
}
