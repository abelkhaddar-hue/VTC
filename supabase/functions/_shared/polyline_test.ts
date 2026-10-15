import { decode, encode } from './polyline.ts'
import { computeRoute } from './route.ts'

const eq = (a: unknown, b: unknown, msg: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`) }

Deno.test('exemple de la documentation Google', () => {
  const pts = [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]
  eq(encode(pts), '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 'encode')
  eq(decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), pts, 'decode')
})

Deno.test('estimation sans clé Google : Twin Center → Morocco Mall', async () => {
  Deno.env.delete('GOOGLE_MAPS_API_KEY')
  const r = await computeRoute({ lng: -7.6327, lat: 33.5862 }, { lng: -7.7065, lat: 33.5765 })
  if (r.source !== 'estimate' || r.distanceM < 6000 || r.distanceM > 12000) throw new Error(JSON.stringify(r))
  eq(decode(r.polyline).length, 5, 'tracé en 5 points')
})
