// Format « polyline encodée » de Google (précision 1e-5). Même code que app/src/data/polyline.ts.
export type LngLat = { lng: number; lat: number }

export function encode(points: LngLat[]): string {
  let out = '', pLat = 0, pLng = 0
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1
    while (n >= 0x20) { out += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5 }
    out += String.fromCharCode(n + 63)
  }
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5), lng = Math.round(p.lng * 1e5)
    enc(lat - pLat); enc(lng - pLng); pLat = lat; pLng = lng
  }
  return out
}

export function decode(s: string): LngLat[] {
  const pts: LngLat[] = []
  let i = 0, lat = 0, lng = 0
  const next = () => {
    let r = 0, shift = 0, b: number
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    return r & 1 ? ~(r >> 1) : r >> 1
  }
  while (i < s.length) { lat += next(); lng += next(); pts.push({ lat: lat / 1e5, lng: lng / 1e5 }) }
  return pts
}
