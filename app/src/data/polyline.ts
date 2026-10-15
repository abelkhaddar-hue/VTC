// Format « polyline encodée » de Google (précision 1e-5). Même code que supabase/functions/_shared/polyline.ts.
import type { LngLat } from './types'

export function decode(s: string | null | undefined): LngLat[] {
  if (!s) return []
  const pts: LngLat[] = []
  let i = 0, lat = 0, lng = 0
  const next = () => {
    let r = 0, shift = 0, b: number
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20 && i <= s.length)
    return r & 1 ? ~(r >> 1) : r >> 1
  }
  while (i < s.length) { lat += next(); lng += next(); pts.push({ lat: lat / 1e5, lng: lng / 1e5 }) }
  return pts
}
