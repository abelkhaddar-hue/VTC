import { encode, type LngLat } from './polyline.ts'

export type Route = { distanceM: number; durationS: number; polyline: string; source: 'google' | 'estimate' }

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
export function haversine(a: LngLat, b: LngLat) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Itinéraire réel par Google Routes API si la clé est configurée, sinon estimation
// (distance à vol d'oiseau × 1,3, 22 km/h en ville) — la même que la couche de démo.
export async function computeRoute(from: LngLat, to: LngLat): Promise<Route> {
  const key = Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (key) {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'fr',
        regionCode: 'MA',
      }),
    })
    if (res.ok) {
      const r = (await res.json()).routes?.[0]
      if (r?.distanceMeters && r?.duration) {
        return { distanceM: r.distanceMeters, durationS: parseInt(String(r.duration), 10), polyline: r.polyline?.encodedPolyline ?? encode([from, to]), source: 'google' }
      }
    } else {
      console.error('routes api', res.status, await res.text())
    }
  }
  const d = Math.max(400, Math.round(haversine(from, to) * 1.3))
  const mid = { lng: from.lng + (to.lng - from.lng) * 0.35, lat: from.lat }
  const mid2 = { lng: mid.lng, lat: from.lat + (to.lat - from.lat) * 0.7 }
  return { distanceM: d, durationS: Math.round(d / (22000 / 3600)) + 60, polyline: encode([from, mid, mid2, { lng: to.lng, lat: mid2.lat }, to]), source: 'estimate' }
}
